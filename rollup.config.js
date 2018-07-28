import babel from 'rollup-plugin-babel'
import { uglify } from 'rollup-plugin-uglify'
import commonjs from 'rollup-plugin-commonjs'
import nodeResolve from 'rollup-plugin-node-resolve'

module.exports = {
  input: 'index.js',
  output: {
    file: './browser.js',
    format: 'umd',
    name: 'remarkMacro'
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    babel({
      presets: [
        [
          'env',
          {
            modules: false
          }
        ]
      ]
    }),
    uglify()
  ]
}
