const path = require('path')
const fs = require('fs')
const Client = require('ssh2-sftp-client')
const dayjs = require('dayjs')
const logSymbols = require('log-symbols')
const core = require('@actions/core')

let remote = core.getInput('SFTP_REMOTE')
let localPath = path.join(process.cwd(), 'dist') // 修改路径以适应新环境
let fileNumber = getPathFileNumber(localPath)
let steps = 100 / fileNumber
let percent = 0

const sftp = new Client()

async function deploy() {
  console.log(logSymbols.info, '正在上传到服务器...')
  sftp
    .connect({
      host: core.getInput('SFTP_HOST'),
      port: 22,
      username: core.getInput('SFTP_USERNAME'),
      password: core.getInput('SFTP_PASSWORD')
    })
    .then(async () => {
      let fromPath = remote + '/dist'
      let uploadPath = remote + '/upload'
      let toPath = remote + '/backup/' + dayjs().format('YYYY-MM-DD(HH:mm:ss)')
      await sftp.uploadDir(localPath, uploadPath)
      if (!(await sftp.exists(remote + '/backup/'))) sftp.mkdir(remote + '/backup/', true)
      if (await sftp.exists(fromPath)) {
        await sftp.rename(fromPath, toPath)
      }
      await sftp.rename(uploadPath, fromPath)
    })
    .then(() => {
      console.log(logSymbols.success, '上传成功😁')
      return sftp.end()
    })
    .catch(err => {
      console.log(logSymbols.error, `上传失败😭\n${err}`)
      return sftp.end()
    })
  sftp.on('upload', () => {
    percent += steps
    console.log(logSymbols.info, `上传进度：${Math.round(percent)}%`)
  })
}

function getPathFileNumber(folder) {
  var number = 0
  function readFolder(folder) {
    try {
      let files = fs.readdirSync(folder)
      files.forEach(item => {
        let fileItemPath = path.join(folder, item)
        let stat = fs.statSync(fileItemPath)
        if (stat.isFile()) number++
        else readFolder(fileItemPath)
      })
    } catch (err) {
      console.log(logSymbols.error, `读取文件错误😖\n${err}`)
    }
  }
  readFolder(folder)
  return number
}

deploy()
