import crypto from 'crypto'
import _md5 from 'md5'

// create hash
const hashSha256 = (text: string) => {
  const hashCrypto = crypto.createHash('sha256')
  return hashCrypto.update(text).digest('hex')
}

export { hashSha256}
