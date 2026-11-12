# Local files example / 本地文件管理示例

Requires Plugin API v5 on native desktop or Android. Build and package from the repository root:

```sh
npm ci
npm run pack
```

Install the `dev.yaqmc.example.files-1.0.0.yaqmc-plugin` package from `plugins/packages/`, grant the requested permissions, and open **Local files** in the sidebar.
Choose a file or directory using the native system picker. Writable directory selection additionally permits explicit create, rename and delete actions. The example previews 4 KiB of a file as text, paginates directories, and asks for a second click before permanent deletion. It never modifies files during activation. Use a scratch folder when trying write operations.

桌面端和 Android 均通过系统选择器授权。选择只读文件/目录后可浏览、分页和预览；选择可写目录后可点击按钮新建示例文件/目录、重命名或删除选中条目。删除需再次点击确认。Android 不提供目录删除；桌面端只允许删除空目录。句柄在插件停用后失效，不应保存。

API documentation: [English](../../docs/plugin-files-api.md) · [中文](../../docs/zh-CN/plugin-files-api.md). SDK: [types](../../sdk/plugin/src/index.ts). Provider Component API v3 is unchanged.
