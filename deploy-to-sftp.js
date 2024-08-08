const path = require('path')
const fs = require('fs')
const Client = require('ssh2-sftp-client')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
const logSymbols = require('log-symbols')
const core = require('@actions/core')
dayjs.extend(utc)
dayjs.extend(timezone)

let remote = core.getInput('SFTP_REMOTE')
let localPath = path.join(process.cwd(), 'dist') // 修改路径以适应新环境
let fileNumber = getPathFileNumber(localPath)
let steps = 100 / fileNumber
let percent = 0

const sftp = new Client()
const connectInfo = {
  host: core.getInput('SFTP_HOST'),
  port: 22,
  username: core.getInput('SFTP_USERNAME'),
  password: core.getInput('SFTP_PASSWORD')
}
async function deploy() {
  console.log(logSymbols.info, '正在上传到服务器...')
  if (core.getInput('SFTP_PRIVATEKEY')) {
    connectInfo.privateKey = core.getInput('SFTP_PRIVATEKEY')
  }
  const maxRetries = 3 // 最大重试次数
  let retryCount = 0
  sftp.on('upload', () => {
    percent += steps
    console.log(logSymbols.info, `上传进度：${Math.round(percent)}%`)
  })
  async function performSFTPTasks() {
    try {
      await sftp.connect(connectInfo)

      let fromPath = remote + '/dist'
      let uploadPath = remote + '/upload'
      let toPath = remote + '/backup/' + dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD(HH:mm:ss)')

      await sftp.uploadDir(localPath, uploadPath)

      if (await sftp.exists(fromPath)) {
        if (core.getInput('BACKUP') === 'true') {
          if (!(await sftp.exists(remote + '/backup/'))) await sftp.mkdir(remote + '/backup/', true)
          await sftp.rename(fromPath, toPath)
        } else {
          await sftp.rmdir(fromPath, true)
        }
      }

      await sftp.rename(uploadPath, fromPath)

      console.log(logSymbols.success, '上传成功😁')
      await sftp.end()
    } catch (err) {
      console.log(logSymbols.error, `上传失败😭\n${err}`)

      retryCount++
      if (retryCount <= maxRetries) {
        console.log(`正在重试... (${retryCount}/${maxRetries})`)
        await performSFTPTasks() // 递归调用重试
      } else {
        console.log('已达到最大重试次数，上传失败')
        await sftp.end()
      }
    }
  }
  await performSFTPTasks()
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
