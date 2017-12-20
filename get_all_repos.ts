import fetch from "node-fetch"
import { currentId } from "async_hooks";
import * as _ from "lodash"
import * as fs from "fs"

const username = "orta"
const query = (cursor: string | undefined) => `
{
  user(login: "${username}") {
    pullRequests(last: 100 ${cursor ? `, before:"${cursor}"` : ""}) {
      pageInfo {
        startCursor
      }
      
      nodes {
        id  
        title
        createdAt
        repository {
          nameWithOwner
        }
      }
    }
  }
}
`

const gh = "https://api.github.com/graphql"
const headers = {
  Authorization: `bearer ` + process.env.DANGER_GITHUB_API_TOKEN
}

const runQuery = (query: string) => fetch(gh, { headers, method: "POST", body: JSON.stringify({ query }) })

const allRepos: any[] = []

const iterate = (cursor?: string) => {
  const GQL = query(cursor)
  console.log("Calling:")
  console.log(GQL)
  runQuery(GQL).then(async r => {
    const response = await r.json()
    const prs = response.data.user.pullRequests
    const lastPR = prs.nodes[prs.nodes.length - 1]
    const date = new Date(lastPR.createdAt)
    const repos = prs.nodes.map((n: any) => n.repository.nameWithOwner)
    allRepos.push(repos)
    
    if (date.getFullYear() === 2017) {
      const cursor = prs.pageInfo.startCursor
      iterate(cursor)
    } else {
      done()
    }
  }) 
}

const initCursor = undefined
iterate(initCursor)

const done = () => {
 const flatRepos = _.flatten(allRepos)
 const grouped = _.groupBy(flatRepos, r => r)
 const uniques = Object.keys(grouped)
 const counters = uniques.map(m => ({ name: m, prs: grouped[m].length }))
 const sortedCounts = counters.sort((a , b) => a.prs > b.prs ? -1 : 1)

 const data = {
   info: {
     repos: {
      total: uniques.length,
      artsy: uniques.filter(f => f.startsWith("artsy")).length,
      cocoapods: uniques.filter(f => f.startsWith("CocoaPods")).length,
      danger: uniques.filter(f => f.startsWith("danger")).length,
      orta: uniques.filter(f => f.startsWith("orta")).length,
    },
    prs:{
      total: flatRepos.length,
      artsy: flatRepos.filter(f => f.startsWith("artsy")).length,
      cocoapods: flatRepos.filter(f => f.startsWith("CocoaPods")).length,
      danger: flatRepos.filter(f => f.startsWith("danger")).length,
      orta: flatRepos.filter(f => f.startsWith("orta")).length,
    }
   },
   repos: sortedCounts
 }
 fs.writeFileSync("data/prs.json", JSON.stringify(data, null, "  "))
 console.log("You contributed to " + counters.length + " repos")
 console.log("saved to data/prs.json")
}
