import csv from 'csvtojson'

export default async function loadCsv(fname: string) {
  const jsonArray = await csv().fromFile(fname)
  return jsonArray
}

export async function insertCsvToModel(fileName: string, insertFunc: Function) {
  console.log(`Create models from csv file ${fileName}...`)
  const rows = await loadCsv(fileName)
  for (const row of rows) {
    await insertFunc(row)
  }
}

