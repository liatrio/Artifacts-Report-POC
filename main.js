const { Octokit } = require('octokit')
const { logger } = require('@4lch4/logger')
const dotenv = require('dotenv')
const path = require('path')
const fs = require('fs-extra')
const converter = require('json-2-csv')

dotenv.config({ path: path.join(__dirname, '.env') })

const ghClient = new Octokit({ auth: process.env.GITHUB_TOKEN })

const GH_ORG = process.env.GITHUB_ORG || 'liatrio'
const MAX_PER_PAGE = 100

async function getOrgReposPage(org, pageNumber) {
  return ghClient.rest.repos.listForOrg({
    org,
    per_page: MAX_PER_PAGE,
    page: pageNumber,
  })
}

async function getOrgRepos(org) {
  try {
    let pageNumber = 1
    let allRepos = []
    let reposPage = await getOrgReposPage(org, pageNumber)

    if (reposPage.data.length > 0) allRepos.push(...reposPage.data)

    while (reposPage.data.length === MAX_PER_PAGE) {
      pageNumber++
      reposPage = await getOrgReposPage(org, pageNumber)
      if (reposPage.data.length > 0) allRepos.push(...reposPage.data)
    }

    return allRepos
  } catch (err) {
    return err
  }
}

async function getRepoArtifactsPage(repo, pageNumber) {
  return ghClient.rest.actions.listArtifactsForRepo({
    owner: GH_ORG,
    repo,
    per_page: MAX_PER_PAGE,
    page: pageNumber,
  })
}

async function getRepoArtifacts(repo) {
  try {
    let pageNumber = 1
    let allArtifacts = []
    let artifactsPage = await getRepoArtifactsPage(repo, pageNumber)

    if (artifactsPage.data.total_count > 0) allArtifacts.push(...artifactsPage.data.artifacts)

    while (artifactsPage.data.artifacts.length === MAX_PER_PAGE) {
      pageNumber++
      artifactsPage = await getRepoArtifactsPage(repo, pageNumber)
      allArtifacts.push(...artifactsPage.data.artifacts)
    }

    return allArtifacts
  } catch (err) {
    return err
  }
}

function bytesToHumanReadable(bytes) {
  if (bytes === 0) {
    return '0.00 B'
  }

  let e = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, e)).toFixed(2) + ' ' + ' KMGTP'.charAt(e) + 'B'
}

async function outputReport(report) {
  try {
    logger.info('[outputReport]: Outputting report...')

    const timestamp = new Date().toISOString().replace(/:/g, '-')

    const jsonFilePath = path.join(__dirname, 'out', `report-${timestamp}.json`)
    const csvFilePath = path.join(__dirname, 'out', `report-${timestamp}.csv`)

    logger.debug(`[outputReport]: Writing report to ${jsonFilePath}...`)

    await fs.ensureDir(path.join(__dirname, 'out'))
    await fs.writeJson(jsonFilePath, report, { spaces: 2 })
    await fs.writeFile(csvFilePath, await converter.json2csv(report))

    console.table(report)

    logger.success(`[outputReport]: Report written to ${jsonFilePath}`)
  } catch (err) {
    logger.error('[outputReport]: Error encountered...')
    logger.error(err)
  }
}

async function main() {
  try {
    logger.info(`[main]: Starting execution...`)

    const repos = await getOrgRepos(GH_ORG)
    const report = []

    for (const repo of repos) {
      logger.debug(`[main]: Checking ${repo.name} for artifacts...`)

      const repoArtifacts = await getRepoArtifacts(repo.name)

      if (repoArtifacts.length > 0) {
        logger.success(`[main]: Found ${repoArtifacts.length} artifacts for ${repo.name}`)
        const repoReport = {
          name: repo.full_name,
          count: repoArtifacts.length,
          totalSizeInBytes: 0,
          totalSizeHumanReadable: '',
        }

        for (const artifact of repoArtifacts) repoReport.totalSizeInBytes += artifact.size_in_bytes

        repoReport.totalSizeHumanReadable = bytesToHumanReadable(repoReport.totalSizeInBytes)

        logger.info(
          `[main]: ${repo.name} total size: ${repoReport.totalSizeHumanReadable} (${repoReport.totalSizeInBytes} bytes)`
        )

        report.push(repoReport)
      }
    }

    await outputReport(report)
  } catch (err) {
    logger.error(`[main]: Error caught...`)
    logger.error(err)
  }
}

main()
  .then(() => {
    logger.success(`Execution completed successfully!`)
  })
  .catch(err => {
    logger.error(`Error returned from main()`)
    logger.error(err)
  })
