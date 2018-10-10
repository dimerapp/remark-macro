'use strict'

/*
 * remark-macro
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const macroRegex = /^(\s{2})?\[(\w+)(.*)?\](?!\()\n?/
const propBuilder = require('./prop')
const visit = require('unist-util-visit')

/**
 * Returns a bad node. This will be later used to
 * show linting errors
 *
 * @method badNode
 *
 * @param  {String} message
 * @param  {String} ruleId
 *
 * @return {Object}
 */
function badNode (message, ruleId) {
  return {
    type: 'BadMacroNode',
    props: {
      ruleId: ruleId || 'syntax-error',
      sourcePath: this.file.path
    },
    data: {
      hName: 'div',
      hChildren: [
        {
          type: 'text',
          value: message
        }
      ]
    }
  }
}

/**
 * Used to detect bad nodes and report them to
 * the linter
 *
 * @method linterFn
 *
 * @param  {Object} tree
 * @param  {Object} file
 *
 * @return {void}
 */
function linterFn (tree, file) {
  visit(tree, 'BadMacroNode', visitor)
  function visitor (node) {
    const message = file.message(node.data.hChildren[0].value, node.position.start)
    message.ruleId = node.props.ruleId
    message.fatal = true

    if (node.props.sourcePath) {
      message.name = message.name.replace(message.file, node.props.sourcePath)
      message.file = node.props.sourcePath
    }
  }
}

/**
 * Processes the inline macros
 *
 * @method processInline
 *
 * @param  {Function}    eat
 * @param  {String}      value
 * @param  {String}      options.$
 * @param  {String}      options.spaces
 * @param  {String}      options.macroName
 * @param  {Object}      options.macro
 * @param  {String}      options.props
 * @param  {Object}      macroFnPayload
 *
 * @return {void}
 */
function processInline (eat, value, { $, spaces, macroName, macro, props }, macroFnPayload) {
  const propsHash = props ? propBuilder(props) : {}
  const astNode = macro.fn(propsHash, macroFnPayload)
  astNode ? eat($)(astNode) : eat($)
}

/**
 * Processes the block node
 *
 * @method processBlock
 *
 * @param  {Function}   eat
 * @param  {String}     value
 * @param  {String}     options.$
 * @param  {String}     options.spaces
 * @param  {String}     options.macroName
 * @param  {Object}     options.macro
 * @param  {String}     options.props
 * @param  {Object}     macroFnPayload
 *
 * @return {void}
 */
function processBlock (eat, value, { $, spaces, macroName, macro, props }, macroFnPayload) {
  /**
   * Keeping a hold whether the tag was ever closed
   * or not
   *
   * @type {Boolean}
   */
  let isClosed = false

  /**
   * Body is everything including opening/closing macro
   * tags and the inner content
   *
   * @type {Array}
   */
  const body = []

  /**
   * Children is the inner content of the macro
   *
   * @type {Array}
   */
  const children = []

  const lines = value.split('\n')

  /**
   * Loop until the ending block is found or the
   * content is over
   */
  while (lines.length) {
    const line = lines.shift()
    body.push(line)

    /**
     * Found ending tag. So break
     * the loop
     */
    if (`${line}` === `${spaces}[/${macroName}]`) {
      isClosed = true
      break
    }

    /**
     * Push the lines, unless the line is same as the macro
     * starting block
     */
    if (!line.startsWith(`${spaces}[${macroName}`)) {
      children.push(line.replace(spaces, ''))
    }
  }

  /**
   * Done with all the content, but the tag was never
   * closed
   */
  if (!isClosed) {
    eat($)(macroFnPayload.badNode(`Unclosed macro: ${macroName}`, 'unclosed-macro'))
    return
  }

  /**
   * Converting props string to an object
   */
  const propsHash = props ? propBuilder(props) : {}

  const astNode = macro.fn(children.join('\n'), propsHash, macroFnPayload)
  astNode ? eat(body.join('\n'))(astNode) : eat(body.join('\n'))
}

module.exports = function () {
  /**
   * Hash of registered macros
   *
   * @type {Object}
   */
  const macros = {}

  function transformNodes (eat, value, silent) {
    /**
     * Regex match for each line can be pretty expensive, this way
     * we return right away when line doesn't start with a
     * macro node
     */
    if (!value.trim().startsWith('[')) {
      return
    }

    const match = macroRegex.exec(value)
    if (!match || match.index !== 0 || silent) {
      return
    }

    const $ = match[0]
    const spaces = typeof (match[1]) === 'undefined' ? '' : match[1]
    const macroName = match[2].trim()
    const props = match[3]

    const macro = macros[macroName]
    if (!macro) {
      return
    }

    /**
     * Payload to be passed to the macro closure
     */
    const macroFnPayload = {
      transformer: this,
      eat,
      badNode: badNode.bind(this)
    }

    if (macro.inline) {
      return processInline(eat, value, { $, spaces, macroName, props, macro }, macroFnPayload)
    }

    return processBlock(eat, value, { $, spaces, macroName, props, macro }, macroFnPayload)
  }

  return {
    /**
     * Adds a new macro to the macros list
     *
     * @method addMacro
     *
     * @param  {String}   name
     * @param  {Function} fn
     * @param  {Boolean}  inline
     *
     * @example
     * ```
     * addMacro('alert', function (content, props, { transfomer, eat }) {
     *   return {
     *     type: 'AlertNode',
     *     data: {
     *       hName: 'div',
     *       children: transfomer.tokenizeBlock(content, eat.now()),
     *       properties: {
     *         className: ['']
     *       }
     *     }
     *   }
     * })
     * ```
     */
    addMacro (name, fn, inline) {
      if (macros[name]) {
        throw new Error(`Cannot redefine the macro ${name}. One already exists`)
      }

      if (typeof (fn) !== 'function') {
        throw new Error('addMacro expects 2nd argument to be a function')
      }

      macros[name] = { fn: fn, inline: inline || false }
      return this
    },

    /**
     * The method to the passed to remark that simply
     * hoosk into the blockTokenizers
     *
     * @method transform
     *
     * @return {void}
     *
     * @example
     * ```
     * remark.use(macro.transformer)
     * ```
     */
    transformer () {
      const { blockMethods, blockTokenizers } = this.Parser.prototype
      blockMethods.splice(blockMethods.indexOf('paragraph'), 0, 'macro')
      blockTokenizers.macro = transformNodes
      return linterFn
    }
  }
}
