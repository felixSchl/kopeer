Kopeer
======

[![npm version](https://badge.fury.io/js/kopeer.svg)](http://badge.fury.io/js/kopeer)
[![build status](https://travis-ci.org/felixSchl/kopeer.svg?branch=next)](https://travis-ci.org/felixSchl/kopeer)
[![Build status](https://ci.appveyor.com/api/projects/status/9d4skulxveafrkl0/branch/next?svg=true)](https://ci.appveyor.com/project/felixSchl/kopeer/branch/next)
![dependencies status](https://david-dm.org/felixschl/kopeer.svg)
> Lean library to copy files and folders recursively, asynchronously.

### Install

> npm install kopeer

### kopeer(source, destination [, options] [, callback])

> Infer the type of op by looking at the source file or folder and perform
> `kopeer.directory(..)` if source is folder and `kopeer.file(..)` if source is
> a file.

```javascript
kopeer('/files', '/backup', function(err) { /* ... */ });
```

For available options, check `kopeer.file` and `kopeer.directory`
below. The options are passed along as they are. Just note that **If a callback
is not provided, a promise is returned instead**.

---

### kopeer.file(source, destination [, options] [, callback])

> Copy a file from `source` to `destination`, creating intermediate directories
> as required.

```javascript
kopeer.file('/files/foo', '/backup/bar', function(err) { /* ... */ });
```

#### Usage

* **source (String)**
    * The path to the file to copy.

* **destination (String)**
    * The path to the file to write to.
        > Note: Any intermediate directories leading up to destination will be
        > created automatically.

        > New: As of version `0.2.0`, `destination` can denote a directory. In
        > this case, the destination is resolved to
        > `destination/{source-filename}`.  _See the example for more
        > information._

* **options (Object) [default: undefined]**
    * **options.dereference (Bool) [default: false]**
        * If given and `true`, resolve any symlinked files and folders and copy
          the actual contents. Otherwise, write the linked file as the target
          file.

    * **options.limit (Int) [default: 512]**
        * The limit of concurrently opened files.
          A higher limit is faster but risks `EMFILE` errors, while a lower
          limit is slower but safer.

          Only applies if `options.dereference === true` and the location
          pointed to by `source` turns out to be directory. Note that the
          directory pointed to will also be fully dereferenced.

* **callback (Function) [default: undefined]**
    * Invoke the given node-style callback with any errors and no result:
      ```javascript
      function(err) { /*...*/ }
      ```

---

### kopeer.directory(source, destination [, options] [, callback])

> Copy a folder recursively from `source` to `destination`, creating
> intermediate directories as required.

```javascript
kopeer.directory('/files', '/backup', function(err) { /* ... */ });
```

#### Usage

* **source (String)**
    * The path to the directory to copy

* **destination (String)**
    * The path to the directory to copy to.

      > Note: Any intermediate directories leading up to destination will be
      > created automatically.

* **options (Object) [default: undefined]**
    * **options.filter (Function: Filepath -> Bool) [default: noop]**
        * Given the target path, decide whether to include this file.

    * **options.ignore (String|Array\<String\>) [default: []]** <sub>since v1.0.0</sub>
        * Given a list of patterns to ignore, create a [minimatch][minimatch]
          filter from each and apply to each path.

    * **options.dereference (Bool) [default: false]**
        * If true, copy symlinked files and folders into the target file tree.

    * **options.rename (Function: Filepath -> Filepath) [default: noop]**
        * Given the target path, return a new target path.

    * **options.limit (Int) [default: 512]**
        * The limit of concurrently opened files.

          A higher limit is faster but risks `EMFILE` errors, while a lower
          limit is slower but safer.

* **callback (Function) [default: undefined]**
    * Invoke the given node-style callback with any errors and no result:
      ```javascript
      function(err) { /*...*/ }
      ```

### Contributing

Business as usual. Get started by running the test suite:

```
npm install
npm test
```

Then fix bug / add feature and submit a pull request.

[minimatch]: https://www.npmjs.com/package/minimatch
