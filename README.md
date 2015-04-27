Kopeer
======


[![Build Status](https://travis-ci.org/felixSchl/kopeer.svg?branch=master)](https://travis-ci.org/felixSchl/kopeer)

> Lean library to copy files and folders recursively, asynchronously.

Usage
=====

### kopeer(source, destination, options)

> Infer the type of op by looking at the source file or folder and perform
> `kopeer.directory(..)` if source is folder and `kopeer.file(..)` if source is
> a file.

```javascript
kopeer("/files", "/backup")
    .then(function()   { /* completed successfully */ })
    .catch(function(e) { /* error while copying    */ })
;
```

For available options, check `kopeer.file` and `kopeer.directory`
below. The options are passed along as they are.

---

### kopeer.file(soure, destination, options)

> Copy a file from `source` to `destination`, creating intermediate directories
> as required.

```javascript
kopeer.file("/files/foo", "/backup/bar")
    .then(function()   { /* completed successfully */ })
    .catch(function(e) { /* error while copying    */ })
;

// As of v0.2.0:
// Copy "/files/foo" to "/backup/foo"
kopeer.file("/files/foo", "/backup/")
    .then(function()   { /* completed successfully */ })
    .catch(function(e) { /* error while copying    */ })
;
```

###### source :: String

The path to the file to copy.

###### destination :: String

The path to the file to write to.

> Note: Any intermediate directories leading up to destination will be created
  automatically.

> New: As of version `0.2.0`, `destination` can denote a directory. In this case,
  the destination is resolved to `destination/{source-filename}`. _See the
  example for more information._

###### options.dereference :: Bool (default: false)

If given and `true`, resolve any symlinked files and folders and copy
the actual contents. Otherwise, write the linked file as the target file.

###### options.limit :: Bool Int (default: 512)

The limit of concurrently opened files.
A higher limit is faster but risks `EMFILE` errors, while a lower limit is
slower but safer. Only applies if `dereference === true` and the location
pointed to by `source` turns out to be directory. Note that the directory
pointed to will also be fully dereferenced.

---

### kopeer.directory(source, destination, options)

> Copy a folder recursively from `source` to `destination`, creating
> intermediate directories as required.

```javascript
kopeer.directory("/files", "/backup")
    .then(function()   { /* completed successfully */ })
    .catch(function(e) { /* error while copying    */ })
;
```

###### source :: String

The path to the directory to copy

###### destination :: String

The path to the directory to copy to.

> Note: Any intermediate directories leading up to destination will be created
  automatically.

###### options.filter :: Filepath -> Bool (default: noop)

Given the target path, decide whether to include this file.

###### options.dereference :: Bool (default: false)

If true, copy symlinked files and folders into the target file tree.

###### options.rename :: Filepath -> Filepath (default: noop)

Given the target path, return a new target path.

###### options.limit :: Int (default: 512)

The limit of concurrently opened files.

A higher limit is faster but risks `EMFILE` errors, while a lower limit is
slower but safer.
