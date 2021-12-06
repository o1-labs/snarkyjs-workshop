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
node dist/1_exercise.js
node dist/2_exercise.js
...
```

If you change an example, you have to re-run typescript first:

```console
npx tsc && node dist/1_exercise.js
```
