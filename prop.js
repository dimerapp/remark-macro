'use strict'

/**
 * remark-macro
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const _ = {
  SPACE: 32,
  COMMA: 44,
  QUOTE: 34,
  EQUAL: 61
}

/**
 * Consumes the node values by moving it to the
 * result object and empty the node properties.
 *
 * Mutates {node and result} both
 *
 * @method consumeNode
 *
 * @param  {Object}    node
 * @param  {Object}    result
 *
 * @return {void}
 */
function consumeNode (node, result) {
  if (!node.key) {
    return
  }
  result[node.key] = node.value
  node.key = ''
  node.value = ''
}

module.exports = function (inString) {
  const chars = inString.split('')

  const result = {}

  const node = {
    key: '',
    value: ''
  }

  /**
   * Prop tells us where to add char in the node
   *
   * @type {String}
   */
  let prop = 'key'

  let underQuotes = false
  let oldCharCode = ''

  while (chars.length) {
    const char = chars.shift()
    const charCode = char.charCodeAt(0)

    if (charCode === _.QUOTE && (!chars[0] || [_.SPACE, _.COMMA].indexOf(chars[0].charCodeAt(0)) > -1)) {
      /**
       * The current char is a quote AND (next char doesn't exists OR next char is a SPACE
       * or COMMA)
       */
      underQuotes = false
    } else if (underQuotes) {
      /**
       * If under quotes, then use all characters
       */
      node[prop] += char
    } else if (charCode === _.QUOTE && [_.SPACE, _.EQUAL].indexOf(oldCharCode) > -1) {
      /**
       * The current char is a quote AND previous char was a EQUAL TO or SPACE
       */
      underQuotes = true
    } else if (charCode === _.SPACE) {
      // ignore whitespace when not underQuotes
    } else if (charCode === _.EQUAL) {
      /**
       * After EQUAL TO, we shift the prop to be value
       */
      prop = 'value'
    } else if (charCode === _.COMMA) {
      /**
       * After COMMA, we shift the prop to be key
       */
      prop = 'key'
      consumeNode(node, result)
    } else {
      /**
       * Else use all values
       */
      node[prop] += char
    }

    oldCharCode = charCode
  }

  consumeNode(node, result)
  return result
}
