import crypto from 'crypto'
import _md5 from 'md5'
/**
 * This method is used for generate MD5 hash code with provided delimiter and array data
 * @param {*} delimiter
 * @param {*} elements
 */
const md5 = (delimiter: string, elements: string[]) => {
  const data = elements.join(delimiter)
  const result = _md5(data)
  return result
}

// create hash, supports currently only SHA256 and MD5
const hash = (text: string, type: string) => {
  if ('SHA256' === type) {
    const hashCrypto = crypto.createHash('sha256')
    return hashCrypto.update(text).digest('hex')
  } else if ('MD5' === type) {
    return _md5(text)
  }
  return text
}

export { md5, hash }
