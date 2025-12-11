const App = require('/lib/xp/app')
const Project = require('/lib/xp/project')
const Context = require('/lib/xp/context')
const Content = require('/lib/xp/content')
const Node = require('/lib/xp/node')
const Repo = require('/lib/xp/repo')
const Util = require('/lib/modules/util')

let connection = null

module.exports = {
    getSites,
    setConfig,
    getConfig
}

function initializeConnection() {
    Context.run({
        user: {
            login: 'su',
            idProvider: 'system'
        },
        principals: ['role:system.admin']
    }, () => {
        if (!Repo.get('automatic-translation-app')) {
            Repo.create({ id: 'automatic-translation-app' })
        }

        if (!connection) {
            connection = Node.connect({
                repoId: 'automatic-translation-app',
                branch: 'master',
                principals: ['role:system.admin']
            })
        }
    })
}

function getSites() {
    const projects = Project.list()
    let sites = []

    projects.forEach(project => {
        try {
            Context.run({
                repository: `com.enonic.cms.${project.id}`,
                branch: 'draft',
                user: {
                    login: 'su',
                    idProvider: 'system'
                },
                principals: ['role:system.admin'],
            }, () => {
                const sitesQuery = Content.query({
                    count: -1,
                    contentTypes: ['portal:site']
                })
                if (sitesQuery && (sitesQuery.count > 0)) {
                    sitesQuery.hits.forEach(hit => {
                        const appKeys = Util.forceArray(hit.data.siteConfig).map(sc => {
                            const appDetails = App.get({ key: sc.applicationKey })
                            return {
                                key: appDetails.key,
                                displayName: appDetails.displayName
                            }
                        })

                        if (appKeys.length > 0) {
                            sites.push({
                                id: hit._id,
                                displayName: `${hit._path} (${project.displayName})`,
                                repoId: project.id,
                                applications: JSON.stringify(appKeys)
                            })
                        }
                    })
                }
            })
        } catch(err) {
            log.error(`Error while get the sites in the layer ${project.id}`)
        }
    })

    initConfigRepo(sites)

    return sites
}

function initConfigRepo(sites) {
    if (!connection) initializeConnection()

    Context.run({
        user: {
            login: 'su',
            idProvider: 'system'
        },
        principals: ['role:system.admin']
    }, () => {
        sites.forEach(site => {
            let siteRepoConfig = connection.get(`/${site.id}-${site.repoId}`)

            if (!siteRepoConfig) {
                setConfig(site.id, site.repoId)
            }
        })
    })
}

function setConfig(siteId, repoId, applicationKey, config) {
    if (!connection) initializeConnection()

    Context.run({
        user: {
            login: 'su',
            idProvider: 'system'
        },
        principals: ['role:system.admin']
    }, () => {
        if (siteId && repoId) {
            let siteRepoConfig = connection.get(`/${repoId}-${siteId}`)

            if (!siteRepoConfig) {
                connection.create({
                    _name: `${repoId}-${siteId}`,
                    data: {
                        config: (applicationKey && config) 
                            ? { [applicationKey.replace(/\./g, '-')]: config } 
                            : {}
                    }
                })
            } else if (applicationKey && config) {
                connection.modify({
                    key: `/${repoId}-${siteId}`,
                    editor: (n) => {
                        if (n.data.config) {
                            n.data.config[applicationKey.replace(/\./g, '-')] = config
                        } else {
                            n.data.config = { [applicationKey.replace(/\./g, '-')]: config }
                        }
                        return n
                    }
                })
            }
        }
    })
}

function getConfig(siteId, repoId, applicationKey) {
    if (!connection) initializeConnection()
    
    return Context.run({
        user: {
            login: 'su',
            idProvider: 'system'
        },
        principals: ['role:system.admin']
    }, () => {
        let siteRepoConfig = connection.get(`/${repoId}-${siteId}`)

        if (applicationKey) {
            return (siteRepoConfig && siteRepoConfig.data && siteRepoConfig.data.config && siteRepoConfig.data.config[applicationKey.replace(/\./g, '-')]) || {}
        } else {
            return (siteRepoConfig && siteRepoConfig.data && siteRepoConfig.data.config) || {}
        }
    })
}
