#![no_std]
extern crate alloc;
include!("../../provider-support/memory.rs");
use alloc::{
    alloc::{alloc, dealloc, realloc, Layout},
    format,
    string::{String, ToString},
    vec::Vec,
};
use serde_json::{json, Value};

#[global_allocator]
static ALLOCATOR: dlmalloc::GlobalDlmalloc = dlmalloc::GlobalDlmalloc;
#[unsafe(export_name = "cabi_realloc")]
unsafe extern "C" fn canonical_realloc(
    old_ptr: *mut u8,
    old_len: usize,
    align: usize,
    new_len: usize,
) -> *mut u8 {
    if old_len == 0 {
        if new_len == 0 {
            return align as *mut u8;
        }
        let pointer = alloc(Layout::from_size_align_unchecked(new_len, align));
        if pointer.is_null() {
            core::arch::wasm32::unreachable();
        }
        return pointer;
    }
    let layout = Layout::from_size_align_unchecked(old_len, align);
    if new_len == 0 {
        dealloc(old_ptr, layout);
        return align as *mut u8;
    }
    let pointer = realloc(old_ptr, layout, new_len);
    if pointer.is_null() {
        core::arch::wasm32::unreachable();
    }
    pointer
}

wit_bindgen::generate!({ path: "../../wit/yaqmc-provider", world: "provider-local-files-storage" });
use yaqmc::provider::{local_files, storage};
const ID: &str = "dev.yaqmc.example.local-files";
const STATE: &str = "example.library.v2";
const MAX_CATALOG_BYTES: usize = 512 * 1024;
struct LocalAudio;

fn fail(code: &str) -> String {
    json!({"code":code,"message":"The local audio example could not complete this operation","retryable":false}).to_string()
}
fn text<'a>(value: &'a Value, key: &str) -> Result<&'a str, String> {
    value[key].as_str().ok_or_else(|| fail("invalid-request"))
}
fn library() -> Result<Value, String> {
    let saved = storage::kv_get(STATE).map_err(|_| fail("storage-failure"))?;
    saved.map_or_else(
        || Ok(json!({"items":[],"root":null,"cursor":""})),
        |s| serde_json::from_str(&s).map_err(|_| fail("storage-failure")),
    )
}
fn song(item: &Value) -> Value {
    let meta = &item["metadata"];
    json!({
        "id":item["id"], "title":meta["title"].as_str().filter(|s| !s.is_empty()).unwrap_or(item["name"].as_str().unwrap_or("Local audio")),
        "artists":[{"id":"local-artist","name":meta["artist"].as_str().unwrap_or("Unknown artist")}],
        "album":{"id":"local-album","title":meta["album"].as_str().unwrap_or("Local files")},
        "artwork":{"src":"","alt":"Local audio","dominantColor":"#64748b"},
        "durationMs":meta["durationMs"].as_u64().unwrap_or(0),"trackNumber":meta["trackNumber"].as_u64().unwrap_or(0),
        "quality":"standard","isFavorite":false,"availability":{"status":"available"},
        "provider":{"providerId":ID,"trackId":item["id"]}
    })
}
fn find<'a>(state: &'a Value, id: &str) -> Result<&'a Value, String> {
    state["items"]
        .as_array()
        .and_then(|items| items.iter().find(|item| item["id"] == id))
        .ok_or_else(|| fail("not-found"))
}
fn fresh_id() -> Result<String, String> {
    let bytes = yaqmc::provider::utilities::random_bytes(16).map_err(|_| fail("cancelled"))?;
    let mut id = String::from("local-");
    for byte in bytes {
        id.push_str(&format!("{byte:02x}"));
    }
    Ok(id)
}
fn search(payload: &Value) -> Result<Value, String> {
    let query = text(payload, "query")?;
    let page = payload["page"].as_u64().unwrap_or(1).max(1);
    let limit = payload["limit"].as_u64().unwrap_or(20).clamp(1, 50);
    let roots = local_files::list_roots().map_err(|_| fail("permission-denied"))?;
    let mut state = library()?;
    let mut items = state["items"].as_array().cloned().unwrap_or_default();
    let original_count = items.len();
    items.retain(|item| {
        item["root"]
            .as_str()
            .is_some_and(|root| roots.iter().any(|r| r == root))
    });
    let action = payload["kind"] == "song" && page == 1;
    let mut scan = action && query == ":scan";
    if action && query == ":add-folder" {
        if let Some(root) =
            local_files::request_root("Choose local audio").map_err(|_| fail("cancelled"))?
        {
            state["root"] = json!(root);
            state["cursor"] = json!("");
            scan = true;
        }
    }
    if scan {
        if let Some(root) = state["root"]
            .as_str()
            .map(ToString::to_string)
            .filter(|root| local_files::list_roots().is_ok_and(|v| v.contains(root)))
        {
            let cursor = state["cursor"].as_str().unwrap_or("");
            if cursor != "done" {
                let page: Value = serde_json::from_str(
                    &local_files::tracks(&root, cursor, 5).map_err(|_| fail("invalid-request"))?,
                )
                .map_err(|_| fail("invalid-request"))?;
                let mut bytes: usize = items.iter().map(|item| item.to_string().len() + 1).sum();
                let mut full = false;
                for item in page["entries"]
                    .as_array()
                    .ok_or_else(|| fail("invalid-request"))?
                {
                    if items.len() >= 256 {
                        full = true;
                        break;
                    }
                    let relative = text(item, "relative")?;
                    if items
                        .iter()
                        .any(|old| old["root"] == root && old["relative"] == relative)
                    {
                        continue;
                    }
                    let mut item = item.clone();
                    item["root"] = json!(root);
                    item["id"] = json!(fresh_id()?);
                    if let Some(metadata) = item["metadata"].as_object_mut() {
                        metadata.remove("artworkDataUri");
                    }
                    let length = item.to_string().len() + 1;
                    if bytes.saturating_add(length) > MAX_CATALOG_BYTES {
                        full = true;
                        break;
                    }
                    bytes += length;
                    items.push(item);
                }
                state["cursor"] = if full {
                    json!("done")
                } else {
                    page["nextCursor"]
                        .as_str()
                        .map_or(json!("done"), |s| json!(s))
                };
            }
        }
    }
    // Catalog and continuation commit together. An interrupted/failed save must
    // never advance the cursor without saving that batch's tracks.
    state["items"] = json!(items);
    if scan || original_count != state["items"].as_array().unwrap().len() {
        storage::kv_set(STATE, &state.to_string()).map_err(|_| fail("storage-failure"))?;
    }
    let filter = if query.starts_with(':') {
        String::new()
    } else {
        query.to_lowercase()
    };
    let found: Vec<Value> = state["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(song)
        .filter(|s| {
            s["title"]
                .as_str()
                .unwrap_or("")
                .to_lowercase()
                .contains(&filter)
        })
        .collect();
    let start = page
        .saturating_sub(1)
        .checked_mul(limit)
        .and_then(|v| usize::try_from(v).ok())
        .unwrap_or(usize::MAX);
    let results: Vec<_> = if payload["kind"] == "song" {
        found
            .iter()
            .skip(start)
            .take(limit as usize)
            .cloned()
            .collect()
    } else {
        Vec::new()
    };
    Ok(
        json!({"kind":payload["kind"],"query":query,"page":page,"hasMore":payload["kind"] == "song" && start.saturating_add(limit as usize)<found.len(),"items":results}),
    )
}
impl Guest for LocalAudio {
    fn invoke(
        capability: String,
        operation: String,
        payload_json: String,
    ) -> Result<String, String> {
        let payload: Value =
            serde_json::from_str(&payload_json).map_err(|_| fail("invalid-request"))?;
        let response = match (capability.as_str(), operation.as_str()) {
            ("provider.catalog", "catalog.status") => {
                json!({"providerId":ID,"profileId":"default","displayName":"Local audio example","connection":"ready","message":"Search :add-folder to choose audio, :scan to continue indexing","preferredQuality":"automatic","capabilities":{"search":true,"album":false,"artist":false,"playlist":false,"lyrics":false,"wordTimedLyrics":false,"streaming":true,"qualitySelection":false}})
            }
            ("provider.catalog", "catalog.search") => search(&payload)?,
            ("provider.catalog", "catalog.song") => song(find(&library()?, text(&payload, "id")?)?),
            ("provider.playback", "playback.resolve")
            | ("provider.playback", "playback.resolve-client-fallback") => {
                let state = library()?;
                let id = text(&payload["song"], "id")?;
                let item = find(&state, id)?;
                let relative = text(item, "relative")?;
                let ext = relative.rsplit('.').next().unwrap_or("").to_lowercase();
                let format = match ext.as_str() {
                    "mp3" => "mp3",
                    "flac" => "flac",
                    "wav" => "wav",
                    "m4a" | "mp4" | "aac" => "aac",
                    _ => return Err(fail("client-unsupported")),
                };
                json!({"source":{"kind":"local","root":item["root"],"relative":relative},"cacheKey":id,"format":format,"qualityLabel":"standard","contentLength":item["size"],"isPreview":false,"selection":{"requestedQuality":"automatic","resolvedQuality":"standard","preview":false,"qualityCapabilities":[]}})
            }
            _ => return Err(fail("unsupported-operation")),
        };
        Ok(response.to_string())
    }
}
export!(LocalAudio);
#[panic_handler]
fn panic(_: &core::panic::PanicInfo<'_>) -> ! {
    core::arch::wasm32::unreachable()
}
