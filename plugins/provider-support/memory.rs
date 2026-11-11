// no_std guests on Rust 1.88 can emit a C memcmp reference. Supply it locally
// so the component does not acquire an undeclared env import.
#[unsafe(export_name = "memcmp")]
unsafe extern "C" fn guest_memcmp(left: *const u8, right: *const u8, length: usize) -> i32 {
    for index in 0..length {
        // Volatile reads prevent LLVM from replacing this loop with memcmp.
        let a = core::ptr::read_volatile(left.add(index));
        let b = core::ptr::read_volatile(right.add(index));
        if a != b {
            return i32::from(a) - i32::from(b);
        }
    }
    0
}
