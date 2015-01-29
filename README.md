Kopeer
======

> Lean library to copy files and folders recursively, asynchronously.

Usage
=====

### kopeer(source, destination, options)

> Infer the type of op by looking at the source file or folder and perform
> `kopeer.directory(..)` if source is folder and `kopeer.file(..)` if source is
> a file.

#### Available options:
Same as `kopeer.directory` and `kopeer.file`.

```javascript
kopeer("/files", "/backup")
    .then(function()   { /* completed successfully */ })
    .catch(function(e) { /* error while copying    */ })
;
```

---

### kopeer.file(soure, destination, options)

> Copy a file from `source` to `destination`

#### Available options:

* `dereference :: Bool (default: false)` - If true and linked file resolves to
  a directory, copy the directory at the target filepath. Else, write the linked
  file as the target file.


```javascript
kopeer.file("/files/foo", "/backup/bar")
    .then(function()   { /* completed successfully */ })
    .catch(function(e) { /* error while copying    */ })
;
```

---

### kopeer.directory(source, destination, options)

> Copy a folder, recursively

#### Available options:

* `filter :: Filepath -> Bool (default: noop)`- Given the target path, decide
  whether to include this file.

* `dereference :: Bool (default: false)` - If true, copy symlinked files and
  folders into the target file tree.

* `rename :: Filepath -> Filepath (default: noop)` - Given the target path,
  return a new target path.

* `limit :: Int (default: 512)` - The limit of concurrently opened files.
  A higher limit is faster but risks `EMFILE` errors, while a lower limit is
  slower but safer.

```javascript
kopeer.directory("/files", "/backup")
    .then(function()   { /* completed successfully */ })
    .catch(function(e) { /* error while copying    */ })
;
```
