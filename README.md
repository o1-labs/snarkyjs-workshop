# snarkyjs Workshop

- slides: https://hackmd.io/@mimoo/rkPI5zluY#/

```console
$ git clone git@github.com:o1-labs/snarkyjs-workshop.git
$ cd snarkyjs-workshop
$ npm install
$ npx tsc
```

Make sure you have node version >= 16.4!

Then you can run individual examples with:

```console
node dist/01_exercise.js
node dist/02_exercise.js
...
```

If you change examples, you have to re-run typescript:

```console
npx tsc && node dist/01_exercise.js
npx tsc && node dist/02_exercise.js
...
```
