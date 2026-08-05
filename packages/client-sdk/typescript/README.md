# @viben/client-sdk

Developer-friendly & type-safe Typescript SDK specifically catered to leverage *@viben/client-sdk* API.

[![Built by Speakeasy](https://img.shields.io/badge/Built_by-SPEAKEASY-374151?style=for-the-badge&labelColor=f3f4f6)](https://www.speakeasy.com/?utm_source=@viben/client-sdk&utm_campaign=typescript)
[![License: MIT](https://img.shields.io/badge/LICENSE_//_MIT-3b5bdb?style=for-the-badge&labelColor=eff6ff)](https://opensource.org/licenses/MIT)


<br /><br />
> [!IMPORTANT]
> This SDK is not yet ready for production use. To complete setup please follow the steps outlined in your [workspace](https://app.speakeasy.com/org/viben/viben). Delete this section before > publishing to a package manager.

<!-- Start Summary [summary] -->
## Summary

Viben Gateway API: Agent Swarm × Code Evolution - Multi-agent orchestration and code evolution API
<!-- End Summary [summary] -->

<!-- Start Table of Contents [toc] -->
## Table of Contents
<!-- $toc-max-depth=2 -->
* [@viben/client-sdk](#vibenclient-sdk)
  * [SDK Installation](#sdk-installation)
  * [Requirements](#requirements)
  * [SDK Example Usage](#sdk-example-usage)
  * [Available Resources and Operations](#available-resources-and-operations)
  * [Standalone functions](#standalone-functions)
  * [Retries](#retries)
  * [Error Handling](#error-handling)
  * [Server Selection](#server-selection)
  * [Custom HTTP Client](#custom-http-client)
  * [Debugging](#debugging)
* [Development](#development)
  * [Maturity](#maturity)
  * [Contributions](#contributions)

<!-- End Table of Contents [toc] -->

<!-- Start SDK Installation [installation] -->
## SDK Installation

> [!TIP]
> To finish publishing your SDK to npm and others you must [run your first generation action](https://www.speakeasy.com/docs/github-setup#step-by-step-guide).


The SDK can be installed with either [npm](https://www.npmjs.com/), [pnpm](https://pnpm.io/), [bun](https://bun.sh/) or [yarn](https://classic.yarnpkg.com/en/) package managers.

### NPM

```bash
npm add <UNSET>
```

### PNPM

```bash
pnpm add <UNSET>
```

### Bun

```bash
bun add <UNSET>
```

### Yarn

```bash
yarn add <UNSET>
```

> [!NOTE]
> This package is published with CommonJS and ES Modules (ESM) support.
<!-- End SDK Installation [installation] -->

<!-- Start Requirements [requirements] -->
## Requirements

For supported JavaScript runtimes, please consult [RUNTIMES.md](RUNTIMES.md).
<!-- End Requirements [requirements] -->

<!-- Start SDK Example Usage [usage] -->
## SDK Example Usage

### Example

```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.agent.list();

  console.log(result);
}

run();

```
<!-- End SDK Example Usage [usage] -->

<!-- Start Available Resources and Operations [operations] -->
## Available Resources and Operations

<details open>
<summary>Available methods</summary>

### [Accounts](docs/sdks/accounts/README.md)

* [list](docs/sdks/accounts/README.md#list)
* [create](docs/sdks/accounts/README.md#create)
* [get](docs/sdks/accounts/README.md#get)
* [update](docs/sdks/accounts/README.md#update)
* [delete](docs/sdks/accounts/README.md#delete)
* [test](docs/sdks/accounts/README.md#test)

### [Agent](docs/sdks/agent/README.md)

* [list](docs/sdks/agent/README.md#list) - List all agents
* [create](docs/sdks/agent/README.md#create)
* [getDefault](docs/sdks/agent/README.md#getdefault)
* [updateDefault](docs/sdks/agent/README.md#updatedefault)
* [listTemplates](docs/sdks/agent/README.md#listtemplates)
* [createTemplate](docs/sdks/agent/README.md#createtemplate)
* [getTemplate](docs/sdks/agent/README.md#gettemplate)
* [instantiateTemplate](docs/sdks/agent/README.md#instantiatetemplate)
* [promote](docs/sdks/agent/README.md#promote)
* [getSessions](docs/sdks/agent/README.md#getsessions)
* [createSession](docs/sdks/agent/README.md#createsession)
* [getSession](docs/sdks/agent/README.md#getsession)
* [deleteSession](docs/sdks/agent/README.md#deletesession)
* [getSessionMessages](docs/sdks/agent/README.md#getsessionmessages)
* [createSessionMessage](docs/sdks/agent/README.md#createsessionmessage)
* [getSessionUiMessages](docs/sdks/agent/README.md#getsessionuimessages)
* [getAvailability](docs/sdks/agent/README.md#getavailability)
* [get](docs/sdks/agent/README.md#get)
* [delete](docs/sdks/agent/README.md#delete)
* [update](docs/sdks/agent/README.md#update)
* [getTasks](docs/sdks/agent/README.md#gettasks)
* [getSessionTasks](docs/sdks/agent/README.md#getsessiontasks)
* [getSessionTaskMessages](docs/sdks/agent/README.md#getsessiontaskmessages)
* [run](docs/sdks/agent/README.md#run)
* [stop](docs/sdks/agent/README.md#stop)
* [approve](docs/sdks/agent/README.md#approve)
* [reject](docs/sdks/agent/README.md#reject)
* [createAnswer](docs/sdks/agent/README.md#createanswer)
* [subscribeTask](docs/sdks/agent/README.md#subscribetask)
* [stopTask](docs/sdks/agent/README.md#stoptask)
* [getSession2](docs/sdks/agent/README.md#getsession2)
* [createSessionSteer](docs/sdks/agent/README.md#createsessionsteer)
* [getPlan](docs/sdks/agent/README.md#getplan)

### [ApiLogs](docs/sdks/apilogs/README.md)

* [getDir](docs/sdks/apilogs/README.md#getdir)
* [listSessions](docs/sdks/apilogs/README.md#listsessions)
* [get](docs/sdks/apilogs/README.md#get)
* [delete](docs/sdks/apilogs/README.md#delete)
* [getSummary](docs/sdks/apilogs/README.md#getsummary)
* [open](docs/sdks/apilogs/README.md#open)

### [Auth](docs/sdks/auth/README.md)

* [createLogin](docs/sdks/auth/README.md#createlogin)
* [createRegister](docs/sdks/auth/README.md#createregister)
* [get](docs/sdks/auth/README.md#get)
* [createCallback](docs/sdks/auth/README.md#createcallback)
* [refresh](docs/sdks/auth/README.md#refresh)
* [validate](docs/sdks/auth/README.md#validate)
* [createLogout](docs/sdks/auth/README.md#createlogout)

### [BrowsePlugins](docs/sdks/browseplugins/README.md)

* [listRegistry](docs/sdks/browseplugins/README.md#listregistry)
* [listInstalled](docs/sdks/browseplugins/README.md#listinstalled)
* [get](docs/sdks/browseplugins/README.md#get)
* [delete](docs/sdks/browseplugins/README.md#delete)
* [install](docs/sdks/browseplugins/README.md#install)

### [Cache](docs/sdks/cache/README.md)

* [listOffline](docs/sdks/cache/README.md#listoffline)
* [getInfo](docs/sdks/cache/README.md#getinfo)
* [getSettings](docs/sdks/cache/README.md#getsettings)
* [updateSetting](docs/sdks/cache/README.md#updatesetting)
* [refresh](docs/sdks/cache/README.md#refresh)
* [delete](docs/sdks/cache/README.md#delete)
* [listShouldRefresh](docs/sdks/cache/README.md#listshouldrefresh)

### [Channels](docs/sdks/channels/README.md)

* [list](docs/sdks/channels/README.md#list) - List all notification channels
* [create](docs/sdks/channels/README.md#create)
* [get](docs/sdks/channels/README.md#get) - Get a specific channel by ID
* [delete](docs/sdks/channels/README.md#delete)
* [update](docs/sdks/channels/README.md#update)
* [createDefault](docs/sdks/channels/README.md#createdefault)
* [send](docs/sdks/channels/README.md#send)
* [test](docs/sdks/channels/README.md#test)
* [createSendTest](docs/sdks/channels/README.md#createsendtest)
* [createWebhook](docs/sdks/channels/README.md#createwebhook)
* [createWebhook2](docs/sdks/channels/README.md#createwebhook2)

### [ChatList](docs/sdks/chatlist/README.md)

* [list](docs/sdks/chatlist/README.md#list)

### [ClientTools](docs/sdks/clienttools/README.md)

* [createComplete](docs/sdks/clienttools/README.md#createcomplete)
* [createRequest](docs/sdks/clienttools/README.md#createrequest)

### [CliTools](docs/sdks/clitools/README.md)

* [detect](docs/sdks/clitools/README.md#detect)
* [check](docs/sdks/clitools/README.md#check)
* [getConfig](docs/sdks/clitools/README.md#getconfig)
* [createConfig](docs/sdks/clitools/README.md#createconfig)
* [updateConfig](docs/sdks/clitools/README.md#updateconfig)

### [Collections](docs/sdks/collections/README.md)

* [list](docs/sdks/collections/README.md#list)
* [create](docs/sdks/collections/README.md#create)
* [get](docs/sdks/collections/README.md#get)
* [delete](docs/sdks/collections/README.md#delete)
* [update](docs/sdks/collections/README.md#update)
* [createItem](docs/sdks/collections/README.md#createitem)
* [deleteItem](docs/sdks/collections/README.md#deleteitem)
* [createFork](docs/sdks/collections/README.md#createfork)
* [createFavorite](docs/sdks/collections/README.md#createfavorite)
* [getComments](docs/sdks/collections/README.md#getcomments)
* [createComment](docs/sdks/collections/README.md#createcomment)

### [CommandQueue](docs/sdks/commandqueue/README.md)

* [enqueue](docs/sdks/commandqueue/README.md#enqueue)
* [getStatus](docs/sdks/commandqueue/README.md#getstatus)
* [listItems](docs/sdks/commandqueue/README.md#listitems)
* [getItem](docs/sdks/commandqueue/README.md#getitem)
* [cancelItem](docs/sdks/commandqueue/README.md#cancelitem)
* [retryItem](docs/sdks/commandqueue/README.md#retryitem)
* [getItemLogs](docs/sdks/commandqueue/README.md#getitemlogs)
* [getConfig](docs/sdks/commandqueue/README.md#getconfig)
* [updateConfig](docs/sdks/commandqueue/README.md#updateconfig)
* [clean](docs/sdks/commandqueue/README.md#clean)

### [Commands](docs/sdks/commands/README.md)

* [listWorkspace](docs/sdks/commands/README.md#listworkspace)
* [listSkills](docs/sdks/commands/README.md#listskills)

### [Cron](docs/sdks/cron/README.md)

* [list](docs/sdks/cron/README.md#list) - List all cron jobs
* [create](docs/sdks/cron/README.md#create)
* [get](docs/sdks/cron/README.md#get) - Get a specific cron job by ID
* [delete](docs/sdks/cron/README.md#delete)
* [update](docs/sdks/cron/README.md#update)
* [enable](docs/sdks/cron/README.md#enable)
* [disable](docs/sdks/cron/README.md#disable)
* [run](docs/sdks/cron/README.md#run)
* [getLogs](docs/sdks/cron/README.md#getlogs)
* [deleteLogs](docs/sdks/cron/README.md#deletelogs)

### [Devices](docs/sdks/devices/README.md)

* [getQr](docs/sdks/devices/README.md#getqr)
* [list](docs/sdks/devices/README.md#list)
* [get](docs/sdks/devices/README.md#get)
* [delete](docs/sdks/devices/README.md#delete)
* [createMessage](docs/sdks/devices/README.md#createmessage)

### [Events](docs/sdks/events/README.md)

* [list](docs/sdks/events/README.md#list)

### [Exchanges](docs/sdks/exchanges/README.md)

* [list](docs/sdks/exchanges/README.md#list)

### [Executors](docs/sdks/executors/README.md)

* [list](docs/sdks/executors/README.md#list) - List available executors
* [getDiscoverSessions](docs/sdks/executors/README.md#getdiscoversessions)
* [getSessionMessages](docs/sdks/executors/README.md#getsessionmessages)
* [getMcpServers](docs/sdks/executors/README.md#getmcpservers)
* [getSkills](docs/sdks/executors/README.md#getskills)
* [getSubagents](docs/sdks/executors/README.md#getsubagents)
* [getSubagent](docs/sdks/executors/README.md#getsubagent)
* [getCommands](docs/sdks/executors/README.md#getcommands)
* [getCommand](docs/sdks/executors/README.md#getcommand)
* [getPrompts](docs/sdks/executors/README.md#getprompts)
* [getPrompt](docs/sdks/executors/README.md#getprompt)
* [createOpenclawTestConnection](docs/sdks/executors/README.md#createopenclawtestconnection) - Test connection to an OpenClaw gateway with device auth handshake
* [listOpenclawRuntimeConfig](docs/sdks/executors/README.md#listopenclawruntimeconfig) - Get the effective OpenClaw gateway config from the server side

### [Files](docs/sdks/files/README.md)

* [list](docs/sdks/files/README.md#list)
* [listContent](docs/sdks/files/README.md#listcontent)
* [updateContent](docs/sdks/files/README.md#updatecontent)
* [create](docs/sdks/files/README.md#create)
* [delete](docs/sdks/files/README.md#delete)
* [listDirectory](docs/sdks/files/README.md#listdirectory)
* [createDirectory](docs/sdks/files/README.md#createdirectory)
* [rename](docs/sdks/files/README.md#rename)
* [copy](docs/sdks/files/README.md#copy)
* [move](docs/sdks/files/README.md#move)
* [open](docs/sdks/files/README.md#open)
* [reveal](docs/sdks/files/README.md#reveal)
* [createOpenFolder](docs/sdks/files/README.md#createopenfolder)
* [listConfigDir](docs/sdks/files/README.md#listconfigdir)
* [getGitStatus](docs/sdks/files/README.md#getgitstatus)
* [listGitDiff](docs/sdks/files/README.md#listgitdiff)

### [Github](docs/sdks/github/README.md)

* [getAuthStatus](docs/sdks/github/README.md#getauthstatus)
* [createAuthGhCli](docs/sdks/github/README.md#createauthghcli)
* [createAuthPat](docs/sdks/github/README.md#createauthpat)
* [deleteAuth](docs/sdks/github/README.md#deleteauth)
* [listRepos](docs/sdks/github/README.md#listrepos)
* [detectRepo](docs/sdks/github/README.md#detectrepo)
* [listReposConnected](docs/sdks/github/README.md#listreposconnected)
* [connectRepo](docs/sdks/github/README.md#connectrepo)
* [connectRepo2](docs/sdks/github/README.md#connectrepo2)
* [listIssues](docs/sdks/github/README.md#listissues)
* [getIssue](docs/sdks/github/README.md#getissue)
* [getIssueComments](docs/sdks/github/README.md#getissuecomments)
* [investigateIssue](docs/sdks/github/README.md#investigateissue)
* [importIssue](docs/sdks/github/README.md#importissue)
* [listPrs](docs/sdks/github/README.md#listprs)
* [createPr](docs/sdks/github/README.md#createpr)
* [getPr](docs/sdks/github/README.md#getpr)
* [listReleases](docs/sdks/github/README.md#listreleases)
* [createRelease](docs/sdks/github/README.md#createrelease)
* [getReleaseLatest](docs/sdks/github/README.md#getreleaselatest)
* [createReleaseGenerateNote](docs/sdks/github/README.md#createreleasegeneratenote)
* [getAutofixConfig](docs/sdks/github/README.md#getautofixconfig)
* [updateAutofixConfig](docs/sdks/github/README.md#updateautofixconfig)
* [listAutofixTasks](docs/sdks/github/README.md#listautofixtasks)
* [createAutofixTask](docs/sdks/github/README.md#createautofixtask)
* [getAutofixTask](docs/sdks/github/README.md#getautofixtask)
* [deleteAutofixTask](docs/sdks/github/README.md#deleteautofixtask)
* [cancelAutofixTask](docs/sdks/github/README.md#cancelautofixtask)
* [approveAutofixTask](docs/sdks/github/README.md#approveautofixtask)
* [analyzeIssue](docs/sdks/github/README.md#analyzeissue)
* [triageIssue](docs/sdks/github/README.md#triageissue)
* [clusterIssue](docs/sdks/github/README.md#clusterissue)
* [listAutofixWorktrees](docs/sdks/github/README.md#listautofixworktrees)
* [deleteAutofixWorktrees](docs/sdks/github/README.md#deleteautofixworktrees)

### [GroupChats](docs/sdks/groupchats/README.md)

* [list](docs/sdks/groupchats/README.md#list)
* [create](docs/sdks/groupchats/README.md#create)
* [get](docs/sdks/groupchats/README.md#get)
* [delete](docs/sdks/groupchats/README.md#delete)
* [update](docs/sdks/groupchats/README.md#update)
* [getMembers](docs/sdks/groupchats/README.md#getmembers)
* [createMember](docs/sdks/groupchats/README.md#createmember)
* [deleteMember](docs/sdks/groupchats/README.md#deletemember)
* [getSessions](docs/sdks/groupchats/README.md#getsessions)
* [createSession](docs/sdks/groupchats/README.md#createsession)
* [getSession](docs/sdks/groupchats/README.md#getsession)
* [deleteSession](docs/sdks/groupchats/README.md#deletesession)
* [updateSession](docs/sdks/groupchats/README.md#updatesession)
* [getSessionAgents](docs/sdks/groupchats/README.md#getsessionagents)
* [getFiles](docs/sdks/groupchats/README.md#getfiles)
* [createFile](docs/sdks/groupchats/README.md#createfile)
* [getFile](docs/sdks/groupchats/README.md#getfile)
* [deleteFile](docs/sdks/groupchats/README.md#deletefile)
* [getPictures](docs/sdks/groupchats/README.md#getpictures)
* [createPicture](docs/sdks/groupchats/README.md#createpicture)
* [getPicture](docs/sdks/groupchats/README.md#getpicture)
* [deletePicture](docs/sdks/groupchats/README.md#deletepicture)
* [getSessionMessages](docs/sdks/groupchats/README.md#getsessionmessages)
* [createSessionMessage](docs/sdks/groupchats/README.md#createsessionmessage)

### [History](docs/sdks/history/README.md)

* [list](docs/sdks/history/README.md#list)
* [create](docs/sdks/history/README.md#create)
* [delete2](docs/sdks/history/README.md#delete2)
* [get](docs/sdks/history/README.md#get)
* [delete](docs/sdks/history/README.md#delete)

### [Ideas](docs/sdks/ideas/README.md)

* [list](docs/sdks/ideas/README.md#list) - List all ideas for a workspace with optional filtering
* [delete2](docs/sdks/ideas/README.md#delete2) - Remove ideas by type or all ideas
* [get](docs/sdks/ideas/README.md#get) - Get a specific idea by ID
* [delete](docs/sdks/ideas/README.md#delete) - Remove a single idea by ID
* [generate](docs/sdks/ideas/README.md#generate) - Generate ideas by analyzing the codebase using AI
* [promote](docs/sdks/ideas/README.md#promote) - Promote an idea to a task
* [createDismiss](docs/sdks/ideas/README.md#createdismiss) - Dismiss an idea (mark as not worth pursuing)
* [list2](docs/sdks/ideas/README.md#list2) - List available idea types (builtin + custom)
* [create](docs/sdks/ideas/README.md#create) - Create a new custom idea type
* [update](docs/sdks/ideas/README.md#update) - Update an existing idea type
* [delete3](docs/sdks/ideas/README.md#delete3) - Delete a custom idea type

### [InputHistory](docs/sdks/inputhistory/README.md)

* [list](docs/sdks/inputhistory/README.md#list)

### [Kanban](docs/sdks/kanban/README.md)

* [getTaskComments](docs/sdks/kanban/README.md#gettaskcomments) - Get all comments for a task
* [createTaskComment](docs/sdks/kanban/README.md#createtaskcomment)
* [deleteTaskComment](docs/sdks/kanban/README.md#deletetaskcomment)
* [updateTaskComment](docs/sdks/kanban/README.md#updatetaskcomment)
* [createTaskCommentReaction](docs/sdks/kanban/README.md#createtaskcommentreaction)
* [getTaskActivities](docs/sdks/kanban/README.md#gettaskactivities) - Get all activities for a task
* [createTaskActivity](docs/sdks/kanban/README.md#createtaskactivity)
* [deleteTaskData](docs/sdks/kanban/README.md#deletetaskdata)

### [Logs](docs/sdks/logs/README.md)

* [init](docs/sdks/logs/README.md#init)
* [getDir](docs/sdks/logs/README.md#getdir)
* [listSessions](docs/sdks/logs/README.md#listsessions)
* [getSession](docs/sdks/logs/README.md#getsession)
* [deleteSession](docs/sdks/logs/README.md#deletesession)
* [add](docs/sdks/logs/README.md#add)
* [delete](docs/sdks/logs/README.md#delete)
* [cleanup](docs/sdks/logs/README.md#cleanup)
* [exportSession](docs/sdks/logs/README.md#exportsession)

### [Marketplace](docs/sdks/marketplace/README.md)

* [listIndex](docs/sdks/marketplace/README.md#listindex)
* [listSources](docs/sdks/marketplace/README.md#listsources)
* [listPlugins](docs/sdks/marketplace/README.md#listplugins)
* [listCategories](docs/sdks/marketplace/README.md#listcategories)
* [getPlugin](docs/sdks/marketplace/README.md#getplugin)
* [deleteCache](docs/sdks/marketplace/README.md#deletecache)
* [search](docs/sdks/marketplace/README.md#search)
* [getCategoryPlugins](docs/sdks/marketplace/README.md#getcategoryplugins)

### [Mcp](docs/sdks/mcp/README.md)

* [list](docs/sdks/mcp/README.md#list) - List installed MCP packages
* [show](docs/sdks/mcp/README.md#show) - Get MCP package details
* [install](docs/sdks/mcp/README.md#install) - Install an MCP package (supports name, name@version, gh:user/repo, ./path)
* [uninstall](docs/sdks/mcp/README.md#uninstall) - Uninstall an MCP package
* [search](docs/sdks/mcp/README.md#search) - Search MCP packages in marketplace
* [getInfo](docs/sdks/mcp/README.md#getinfo) - Get MCP package details from marketplace
* [download](docs/sdks/mcp/README.md#download) - Download MCP package to a directory
* [listInstalled](docs/sdks/mcp/README.md#listinstalled) - List globally installed MCP servers
* [getAgentServers](docs/sdks/mcp/README.md#getagentservers)
* [createAgentServer](docs/sdks/mcp/README.md#createagentserver)
* [getAgentServer](docs/sdks/mcp/README.md#getagentserver)
* [deleteAgentServer](docs/sdks/mcp/README.md#deleteagentserver)
* [updateAgentServer](docs/sdks/mcp/README.md#updateagentserver)
* [enableAgentServer](docs/sdks/mcp/README.md#enableagentserver)
* [disableAgentServer](docs/sdks/mcp/README.md#disableagentserver)
* [createPortStatu](docs/sdks/mcp/README.md#createportstatu)
* [killProcess](docs/sdks/mcp/README.md#killprocess)
* [createProcessAlive](docs/sdks/mcp/README.md#createprocessalive)
* [getInspectorHealth](docs/sdks/mcp/README.md#getinspectorhealth)
* [getInspectorConfig](docs/sdks/mcp/README.md#getinspectorconfig)
* [getInspectorToken](docs/sdks/mcp/README.md#getinspectortoken)
* [listInspectorSessions](docs/sdks/mcp/README.md#listinspectorsessions)
* [deleteInspectorSession](docs/sdks/mcp/README.md#deleteinspectorsession)
* [listInspectorMcp](docs/sdks/mcp/README.md#listinspectormcp)
* [createInspectorMcp](docs/sdks/mcp/README.md#createinspectormcp)
* [deleteInspectorMcp](docs/sdks/mcp/README.md#deleteinspectormcp)
* [listInspectorStdio](docs/sdks/mcp/README.md#listinspectorstdio)
* [listInspectorSse](docs/sdks/mcp/README.md#listinspectorsse)
* [createInspectorSse](docs/sdks/mcp/README.md#createinspectorsse)
* [createInspectorMessage](docs/sdks/mcp/README.md#createinspectormessage)

### [McpMarket](docs/sdks/mcpmarket/README.md)

* [list](docs/sdks/mcpmarket/README.md#list)
* [search](docs/sdks/mcpmarket/README.md#search)
* [listCategories](docs/sdks/mcpmarket/README.md#listcategories)
* [get](docs/sdks/mcpmarket/README.md#get)
* [download](docs/sdks/mcpmarket/README.md#download)
* [createFavorite](docs/sdks/mcpmarket/README.md#createfavorite)
* [getComments](docs/sdks/mcpmarket/README.md#getcomments)
* [createComment](docs/sdks/mcpmarket/README.md#createcomment)
* [createRating](docs/sdks/mcpmarket/README.md#createrating)

### [Mesh](docs/sdks/mesh/README.md)

* [listPeers](docs/sdks/mesh/README.md#listpeers)
* [connect](docs/sdks/mesh/README.md#connect)

### [Models](docs/sdks/models/README.md)

* [getDefault](docs/sdks/models/README.md#getdefault)
* [updateDefault](docs/sdks/models/README.md#updatedefault)
* [listAliases](docs/sdks/models/README.md#listaliases)
* [createAlias](docs/sdks/models/README.md#createalias)
* [deleteAlias](docs/sdks/models/README.md#deletealias)
* [reload](docs/sdks/models/README.md#reload)
* [list](docs/sdks/models/README.md#list) - List all models
* [create](docs/sdks/models/README.md#create)
* [get](docs/sdks/models/README.md#get) - Get a specific model by ID
* [delete](docs/sdks/models/README.md#delete)
* [update](docs/sdks/models/README.md#update)
* [enable](docs/sdks/models/README.md#enable)
* [disable](docs/sdks/models/README.md#disable)
* [getConfig](docs/sdks/models/README.md#getconfig)
* [updateConfig](docs/sdks/models/README.md#updateconfig)
* [deleteConfig](docs/sdks/models/README.md#deleteconfig)

### [OfficialRegistry](docs/sdks/officialregistry/README.md)

* [listServers](docs/sdks/officialregistry/README.md#listservers)
* [getServer](docs/sdks/officialregistry/README.md#getserver)
* [getServerVersions](docs/sdks/officialregistry/README.md#getserverversions)
* [deleteCache](docs/sdks/officialregistry/README.md#deletecache)
* [deleteServerCache](docs/sdks/officialregistry/README.md#deleteservercache)

### [Packages](docs/sdks/packages/README.md)

* [listInstalled](docs/sdks/packages/README.md#listinstalled)
* [createUpdate](docs/sdks/packages/README.md#createupdate)
* [listMcp](docs/sdks/packages/README.md#listmcp)
* [listSkills](docs/sdks/packages/README.md#listskills)

### [Page](docs/sdks/page/README.md)

* [createPublish](docs/sdks/page/README.md#createpublish)
* [createPublishStatu](docs/sdks/page/README.md#createpublishstatu)
* [createPublishHistory](docs/sdks/page/README.md#createpublishhistory)
* [createPublishVersion](docs/sdks/page/README.md#createpublishversion)
* [createPublishRollback](docs/sdks/page/README.md#createpublishrollback)
* [list](docs/sdks/page/README.md#list) - List pages in workspace
* [view](docs/sdks/page/README.md#view) - Get page by uid
* [createCreate](docs/sdks/page/README.md#createcreate) - Create a new page
* [createApplyTemplate](docs/sdks/page/README.md#createapplytemplate) - Apply a page template to an empty markdown page
* [createDelete](docs/sdks/page/README.md#createdelete) - Delete a page
* [createUpdateContent](docs/sdks/page/README.md#createupdatecontent) - Update page markdown content (preserves YAML frontmatter)
* [serve2](docs/sdks/page/README.md#serve2) - Serve page content
* [serve](docs/sdks/page/README.md#serve) - Serve page content
* [createUpdateConfig](docs/sdks/page/README.md#createupdateconfig) - Update page config (name, description, icon, cover, page_width, show_toc)
* [reorder](docs/sdks/page/README.md#reorder) - Reorder pages within a parent level
* [duplicate](docs/sdks/page/README.md#duplicate) - Duplicate a page (copy all files with a new uid)
* [createTemplate](docs/sdks/page/README.md#createtemplate) - List available page templates
* [uploadAsset](docs/sdks/page/README.md#uploadasset)
* [getSDKV1VibenPageSDK](docs/sdks/page/README.md#getsdkv1vibenpagesdk) - Serve viben-page-sdk.js
* [getSDKV1VibenPageTokens](docs/sdks/page/README.md#getsdkv1vibenpagetokens) - Serve viben-page-tokens.css

### [Patches](docs/sdks/patches/README.md)

* [list](docs/sdks/patches/README.md#list)

### [Pet](docs/sdks/pet/README.md)

* [list](docs/sdks/pet/README.md#list)
* [show](docs/sdks/pet/README.md#show)
* [set](docs/sdks/pet/README.md#set)
* [remove](docs/sdks/pet/README.md#remove)
* [getCommunity](docs/sdks/pet/README.md#getcommunity)
* [search](docs/sdks/pet/README.md#search)
* [getPreview](docs/sdks/pet/README.md#getpreview)
* [install](docs/sdks/pet/README.md#install)
* [getConfig](docs/sdks/pet/README.md#getconfig)
* [updateConfig](docs/sdks/pet/README.md#updateconfig)
* [listSources](docs/sdks/pet/README.md#listsources)
* [addSource](docs/sdks/pet/README.md#addsource)
* [removeSource](docs/sdks/pet/README.md#removesource)
* [import](docs/sdks/pet/README.md#import)
* [export](docs/sdks/pet/README.md#export)
* [getAsset](docs/sdks/pet/README.md#getasset)

### [Preferences](docs/sdks/preferences/README.md)

* [list](docs/sdks/preferences/README.md#list)
* [update](docs/sdks/preferences/README.md#update)
* [listDeveloper](docs/sdks/preferences/README.md#listdeveloper)
* [updateDeveloper](docs/sdks/preferences/README.md#updatedeveloper)
* [listDeveloperIde](docs/sdks/preferences/README.md#listdeveloperide)
* [updateDeveloperIde](docs/sdks/preferences/README.md#updatedeveloperide)
* [listDeveloperTerminal](docs/sdks/preferences/README.md#listdeveloperterminal)
* [updateDeveloperTerminal](docs/sdks/preferences/README.md#updatedeveloperterminal)
* [listNotifications](docs/sdks/preferences/README.md#listnotifications)
* [updateNotification](docs/sdks/preferences/README.md#updatenotification)

### [Preview](docs/sdks/preview/README.md)

* [listNodeAvailable](docs/sdks/preview/README.md#listnodeavailable) - Check if Node.js is available for Live Preview
* [listStartSse](docs/sdks/preview/README.md#liststartsse) - Start a Vite preview server with SSE streaming for real-time feedback
* [start](docs/sdks/preview/README.md#start) - Start a Vite preview server for a task
* [stop](docs/sdks/preview/README.md#stop) - Stop a Vite preview server
* [getStatu](docs/sdks/preview/README.md#getstatu) - Get status of a preview server
* [createStopAll](docs/sdks/preview/README.md#createstopall) - Stop all running preview servers
* [list](docs/sdks/preview/README.md#list) - List all active preview servers
* [createKillPort](docs/sdks/preview/README.md#createkillport) - Kill the process occupying a specific port

### [Providers](docs/sdks/providers/README.md)

* [getDefault](docs/sdks/providers/README.md#getdefault)
* [updateDefault](docs/sdks/providers/README.md#updatedefault)
* [reload](docs/sdks/providers/README.md#reload)
* [list](docs/sdks/providers/README.md#list) - List all providers
* [create](docs/sdks/providers/README.md#create)
* [get](docs/sdks/providers/README.md#get) - Get a specific provider by ID
* [delete](docs/sdks/providers/README.md#delete)
* [update](docs/sdks/providers/README.md#update)
* [enable](docs/sdks/providers/README.md#enable)
* [disable](docs/sdks/providers/README.md#disable)
* [test](docs/sdks/providers/README.md#test)
* [getDiscoverModels](docs/sdks/providers/README.md#getdiscovermodels)
* [getModels](docs/sdks/providers/README.md#getmodels)
* [enableModel](docs/sdks/providers/README.md#enablemodel)
* [disableModel](docs/sdks/providers/README.md#disablemodel)
* [listApiKeys](docs/sdks/providers/README.md#listapikeys)
* [createValidateKey](docs/sdks/providers/README.md#createvalidatekey)
* [listApiKeysAll](docs/sdks/providers/README.md#listapikeysall)

### [Python](docs/sdks/python/README.md)

* [detect](docs/sdks/python/README.md#detect)
* [check](docs/sdks/python/README.md#check)
* [checkPackage](docs/sdks/python/README.md#checkpackage)
* [createPackageInstallCommand](docs/sdks/python/README.md#createpackageinstallcommand)

### [Queue](docs/sdks/queue/README.md)

* [enqueue](docs/sdks/queue/README.md#enqueue)
* [getStatus](docs/sdks/queue/README.md#getstatus)
* [listTasks](docs/sdks/queue/README.md#listtasks)
* [getTaskRunning](docs/sdks/queue/README.md#gettaskrunning)
* [getTask](docs/sdks/queue/README.md#gettask)
* [deleteTask](docs/sdks/queue/README.md#deletetask)
* [getTaskStream](docs/sdks/queue/README.md#gettaskstream)
* [retryTask](docs/sdks/queue/README.md#retrytask)
* [getConfig](docs/sdks/queue/README.md#getconfig)
* [updateConfig](docs/sdks/queue/README.md#updateconfig)
* [createEnqueueBatch](docs/sdks/queue/README.md#createenqueuebatch)
* [createClearHistory](docs/sdks/queue/README.md#createclearhistory)

### [Reward](docs/sdks/reward/README.md)

* [listTypes](docs/sdks/reward/README.md#listtypes) - List available reward types (builtin + custom)
* [createType](docs/sdks/reward/README.md#createtype) - Create a new custom reward type
* [getType](docs/sdks/reward/README.md#gettype) - Get a specific reward type by name
* [updateType](docs/sdks/reward/README.md#updatetype) - Update a custom reward type
* [deleteType](docs/sdks/reward/README.md#deletetype) - Delete a custom reward type
* [compute](docs/sdks/reward/README.md#compute) - Compute reward for a task by spawning the reward agent
* [select](docs/sdks/reward/README.md#select) - Select best task using PPO metrics

### [Sandbox](docs/sdks/sandbox/README.md)

* [getAvailable](docs/sdks/sandbox/README.md#getavailable)
* [createExec](docs/sdks/sandbox/README.md#createexec)
* [createRunFile](docs/sdks/sandbox/README.md#createrunfile)
* [stop](docs/sdks/sandbox/README.md#stop)

### [ServiceKeys](docs/sdks/servicekeys/README.md)

* [list](docs/sdks/servicekeys/README.md#list)
* [create](docs/sdks/servicekeys/README.md#create)
* [get](docs/sdks/servicekeys/README.md#get)
* [delete](docs/sdks/servicekeys/README.md#delete)
* [update](docs/sdks/servicekeys/README.md#update)
* [validate](docs/sdks/servicekeys/README.md#validate)
* [createUsage](docs/sdks/servicekeys/README.md#createusage)

### [Sessions](docs/sdks/sessions/README.md)

* [list](docs/sdks/sessions/README.md#list) - List all sessions
* [create](docs/sdks/sessions/README.md#create)
* [get](docs/sdks/sessions/README.md#get) - Get a specific session by ID
* [delete](docs/sdks/sessions/README.md#delete)
* [update](docs/sdks/sessions/README.md#update)
* [getMessages](docs/sdks/sessions/README.md#getmessages)
* [getUiMessages](docs/sdks/sessions/README.md#getuimessages)

### [Skill](docs/sdks/skill/README.md)

* [list](docs/sdks/skill/README.md#list) - List installed skills
* [getAvailable](docs/sdks/skill/README.md#getavailable) - List available skills from marketplace
* [listEnabled](docs/sdks/skill/README.md#listenabled) - Get enabled skills for an agent
* [view](docs/sdks/skill/README.md#view) - Get skill by name
* [install](docs/sdks/skill/README.md#install) - Install a skill
* [uninstall](docs/sdks/skill/README.md#uninstall) - Uninstall a skill
* [enable](docs/sdks/skill/README.md#enable) - Enable a skill for an agent
* [disable](docs/sdks/skill/README.md#disable) - Disable a skill for an agent
* [search](docs/sdks/skill/README.md#search) - Search skill packages in marketplace
* [getInfo](docs/sdks/skill/README.md#getinfo) - Get skill package details from marketplace
* [listClawhubPackages](docs/sdks/skill/README.md#listclawhubpackages) - List ClaWHub skill packages
* [searchClawhub](docs/sdks/skill/README.md#searchclawhub) - Search ClaWHub skill packages
* [download](docs/sdks/skill/README.md#download) - Download skill package to a directory
* [createFavorite](docs/sdks/skill/README.md#createfavorite) - Toggle favorite for a marketplace skill

### [SkillMarket](docs/sdks/skillmarket/README.md)

* [list](docs/sdks/skillmarket/README.md#list)
* [search](docs/sdks/skillmarket/README.md#search)
* [listCategories](docs/sdks/skillmarket/README.md#listcategories)
* [get](docs/sdks/skillmarket/README.md#get)
* [download](docs/sdks/skillmarket/README.md#download)
* [createFavorite](docs/sdks/skillmarket/README.md#createfavorite)
* [getComments](docs/sdks/skillmarket/README.md#getcomments)
* [createComment](docs/sdks/skillmarket/README.md#createcomment)
* [createRating](docs/sdks/skillmarket/README.md#createrating)

### [System](docs/sdks/system/README.md)

* [getInfo](docs/sdks/system/README.md#getinfo)
* [listPublicIp](docs/sdks/system/README.md#listpublicip)

### [Tasks](docs/sdks/tasks/README.md)

* [list](docs/sdks/tasks/README.md#list) - List all tasks for a workspace (workspace_path required)
* [create](docs/sdks/tasks/README.md#create)
* [get](docs/sdks/tasks/README.md#get) - Get a specific task by ID
* [update2](docs/sdks/tasks/README.md#update2)
* [delete](docs/sdks/tasks/README.md#delete)
* [update](docs/sdks/tasks/README.md#update)
* [getSpecs](docs/sdks/tasks/README.md#getspecs) - Get task specs data (PRD, subtasks, logs, files)
* [createBatchEvent](docs/sdks/tasks/README.md#createbatchevent) - Apply an event to multiple tasks (batch operation)
* [getRunning](docs/sdks/tasks/README.md#getrunning) - Check if a task's execution process is currently running
* [createSetBranch](docs/sdks/tasks/README.md#createsetbranch) - Set Git branch for a task
* [createSetBase](docs/sdks/tasks/README.md#createsetbase) - Set PR target branch for a task
* [createSetAgent](docs/sdks/tasks/README.md#createsetagent) - Set associated agent configuration for a task
* [createInitContext](docs/sdks/tasks/README.md#createinitcontext) - Initialize empty context files (implement.jsonl, check.jsonl, fix.jsonl) for a task. Use add-context to add specific files.
* [createAddContext](docs/sdks/tasks/README.md#createaddcontext) - Add context files to a task
* [createRemoveContext](docs/sdks/tasks/README.md#createremovecontext) - Remove context files from a task
* [createListContext](docs/sdks/tasks/README.md#createlistcontext) - List all context entries for a task
* [createValidateContext](docs/sdks/tasks/README.md#createvalidatecontext) - Validate that all context file references exist
* [execute](docs/sdks/tasks/README.md#execute) - Trigger task execution via queue system
* [stop](docs/sdks/tasks/README.md#stop) - Stop task execution
* [createRunning](docs/sdks/tasks/README.md#createrunning) - Check if task execution is running
* [createQueueStatu](docs/sdks/tasks/README.md#createqueuestatu) - Get queue status
* [createQueueConfig](docs/sdks/tasks/README.md#createqueueconfig) - Get or update queue configuration
* [createBatchEnqueue](docs/sdks/tasks/README.md#createbatchenqueue) - Batch enqueue multiple tasks for execution
* [createClearHistory](docs/sdks/tasks/README.md#createclearhistory) - Clear completed and failed tasks from queue history
* [createEvent](docs/sdks/tasks/README.md#createevent) - Get event history for a task
* [createSpec](docs/sdks/tasks/README.md#createspec) - Get task specs (PRD, subtasks, logs)
* [listEventsStream](docs/sdks/tasks/README.md#listeventsstream) - SSE stream for task events
* [listExecutionStream](docs/sdks/tasks/README.md#listexecutionstream) - SSE stream for task execution progress
* [start](docs/sdks/tasks/README.md#start) - Start a task: set as current task, queue -> in_progress, optionally trigger execution
* [createFinish](docs/sdks/tasks/README.md#createfinish) - Finish a task: clear current task marker
* [pause](docs/sdks/tasks/README.md#pause) - Pause a task: in_progress/queue -> paused (saves pausedSnapshot)
* [resume](docs/sdks/tasks/README.md#resume) - Resume a paused task: paused -> queue/in_progress
* [approve](docs/sdks/tasks/README.md#approve) - Approve a task in review: review -> completed
* [reject](docs/sdks/tasks/README.md#reject) - Reject a task in review: review -> backlog
* [retry](docs/sdks/tasks/README.md#retry) - Retry a failed task: failed -> queue
* [cancel](docs/sdks/tasks/README.md#cancel) - Cancel a task: * -> cancelled (terminal state)
* [enqueue](docs/sdks/tasks/README.md#enqueue) - Move task from backlog to queue for execution
* [dequeue](docs/sdks/tasks/README.md#dequeue) - Remove task from queue back to backlog
* [archive](docs/sdks/tasks/README.md#archive) - Archive a completed task: completed -> archived
* [listListArchive](docs/sdks/tasks/README.md#listlistarchive) - List archived tasks
* [createReview](docs/sdks/tasks/README.md#createreview) - View task details for review
* [createContext](docs/sdks/tasks/README.md#createcontext) - Get session context for AI agents
* [createStatu](docs/sdks/tasks/README.md#createstatu) - Get task status summary or details
* [createCreatePr](docs/sdks/tasks/README.md#createcreatepr) - Create PR from task
* [createAddSession](docs/sdks/tasks/README.md#createaddsession) - Add a new session to journal file and update index.md
* [createPlan](docs/sdks/tasks/README.md#createplan) - Start Plan Agent to plan a task
* [createPlanPhase](docs/sdks/tasks/README.md#createplanphase) - Run plan phase for a task (spawns plan agent)
* [createImplementPhase](docs/sdks/tasks/README.md#createimplementphase) - Run implement phase for a task (spawns implement agent)
* [createCheckPhase](docs/sdks/tasks/README.md#createcheckphase) - Run check phase for a task (spawns check agent)
* [createWorkPhase](docs/sdks/tasks/README.md#createworkphase) - Run work phase for a task (spawns work agent)
* [view](docs/sdks/tasks/README.md#view) - View task details
* [createDelete](docs/sdks/tasks/README.md#createdelete) - Delete a task
* [list2](docs/sdks/tasks/README.md#list2) - List tasks
* [createCreate](docs/sdks/tasks/README.md#createcreate) - Create a new task
* [createUpdate](docs/sdks/tasks/README.md#createupdate) - Update task fields (not status - use lifecycle endpoints for status changes)
* [createCreateWorktree](docs/sdks/tasks/README.md#createcreateworktree) - Create isolated git worktree for a task
* [createValidateCheckPhasePassed](docs/sdks/tasks/README.md#createvalidatecheckphasepassed) - Validate check phase passed (runs verify commands or checks completion markers)
* [cleanup](docs/sdks/tasks/README.md#cleanup) - Cleanup worktrees and related resources
* [getSessions](docs/sdks/tasks/README.md#getsessions)
* [listEventsStream2](docs/sdks/tasks/README.md#listeventsstream2)
* [getEvents](docs/sdks/tasks/README.md#getevents)
* [createEvent2](docs/sdks/tasks/README.md#createevent2)
* [getEventStream](docs/sdks/tasks/README.md#geteventstream)
* [getState](docs/sdks/tasks/README.md#getstate)
* [validateEvent](docs/sdks/tasks/README.md#validateevent)

### [Telemetry](docs/sdks/telemetry/README.md)

* [listDates](docs/sdks/telemetry/README.md#listdates)
* [listTraces](docs/sdks/telemetry/README.md#listtraces)
* [getTrace](docs/sdks/telemetry/README.md#gettrace)
* [getTraceSpans](docs/sdks/telemetry/README.md#gettracespans)
* [clean](docs/sdks/telemetry/README.md#clean)
* [listStats](docs/sdks/telemetry/README.md#liststats)

### [Tunnel](docs/sdks/tunnel/README.md)

* [getStatus](docs/sdks/tunnel/README.md#getstatus)
* [start](docs/sdks/tunnel/README.md#start)
* [stop](docs/sdks/tunnel/README.md#stop)
* [restart](docs/sdks/tunnel/README.md#restart)

### [User](docs/sdks/user/README.md)

* [listMe](docs/sdks/user/README.md#listme)
* [updateMe](docs/sdks/user/README.md#updateme)
* [listMeFavorites](docs/sdks/user/README.md#listmefavorites)
* [listMeApiKeys](docs/sdks/user/README.md#listmeapikeys)
* [createMeApiKey](docs/sdks/user/README.md#createmeapikey)
* [deleteMeApiKey](docs/sdks/user/README.md#deletemeapikey)
* [get](docs/sdks/user/README.md#get)

### [Voice](docs/sdks/voice/README.md)

* [createToken](docs/sdks/voice/README.md#createtoken)

### [Workspaces](docs/sdks/workspaces/README.md)

* [list](docs/sdks/workspaces/README.md#list) - List all workspaces including the global workspace
* [detect](docs/sdks/workspaces/README.md#detect) - Detect folder status (.git and .viben directories)
* [createCreate](docs/sdks/workspaces/README.md#createcreate)
* [delete](docs/sdks/workspaces/README.md#delete)

</details>
<!-- End Available Resources and Operations [operations] -->

<!-- Start Standalone functions [standalone-funcs] -->
## Standalone functions

All the methods listed above are available as standalone functions. These
functions are ideal for use in applications running in the browser, serverless
runtimes or other environments where application bundle size is a primary
concern. When using a bundler to build your application, all unused
functionality will be either excluded from the final bundle or tree-shaken away.

To read more about standalone functions, check [FUNCTIONS.md](./FUNCTIONS.md).

<details>

<summary>Available standalone functions</summary>

- [`accountsCreate`](docs/sdks/accounts/README.md#create)
- [`accountsDelete`](docs/sdks/accounts/README.md#delete)
- [`accountsGet`](docs/sdks/accounts/README.md#get)
- [`accountsList`](docs/sdks/accounts/README.md#list)
- [`accountsTest`](docs/sdks/accounts/README.md#test)
- [`accountsUpdate`](docs/sdks/accounts/README.md#update)
- [`agentApprove`](docs/sdks/agent/README.md#approve)
- [`agentCreate`](docs/sdks/agent/README.md#create)
- [`agentCreateAnswer`](docs/sdks/agent/README.md#createanswer)
- [`agentCreateSession`](docs/sdks/agent/README.md#createsession)
- [`agentCreateSessionMessage`](docs/sdks/agent/README.md#createsessionmessage)
- [`agentCreateSessionSteer`](docs/sdks/agent/README.md#createsessionsteer)
- [`agentCreateTemplate`](docs/sdks/agent/README.md#createtemplate)
- [`agentDelete`](docs/sdks/agent/README.md#delete)
- [`agentDeleteSession`](docs/sdks/agent/README.md#deletesession)
- [`agentGet`](docs/sdks/agent/README.md#get)
- [`agentGetAvailability`](docs/sdks/agent/README.md#getavailability)
- [`agentGetDefault`](docs/sdks/agent/README.md#getdefault)
- [`agentGetPlan`](docs/sdks/agent/README.md#getplan)
- [`agentGetSession`](docs/sdks/agent/README.md#getsession)
- [`agentGetSession2`](docs/sdks/agent/README.md#getsession2)
- [`agentGetSessionMessages`](docs/sdks/agent/README.md#getsessionmessages)
- [`agentGetSessions`](docs/sdks/agent/README.md#getsessions)
- [`agentGetSessionTaskMessages`](docs/sdks/agent/README.md#getsessiontaskmessages)
- [`agentGetSessionTasks`](docs/sdks/agent/README.md#getsessiontasks)
- [`agentGetSessionUiMessages`](docs/sdks/agent/README.md#getsessionuimessages)
- [`agentGetTasks`](docs/sdks/agent/README.md#gettasks)
- [`agentGetTemplate`](docs/sdks/agent/README.md#gettemplate)
- [`agentInstantiateTemplate`](docs/sdks/agent/README.md#instantiatetemplate)
- [`agentList`](docs/sdks/agent/README.md#list) - List all agents
- [`agentListTemplates`](docs/sdks/agent/README.md#listtemplates)
- [`agentPromote`](docs/sdks/agent/README.md#promote)
- [`agentReject`](docs/sdks/agent/README.md#reject)
- [`agentRun`](docs/sdks/agent/README.md#run)
- [`agentStop`](docs/sdks/agent/README.md#stop)
- [`agentStopTask`](docs/sdks/agent/README.md#stoptask)
- [`agentSubscribeTask`](docs/sdks/agent/README.md#subscribetask)
- [`agentUpdate`](docs/sdks/agent/README.md#update)
- [`agentUpdateDefault`](docs/sdks/agent/README.md#updatedefault)
- [`apiLogsDelete`](docs/sdks/apilogs/README.md#delete)
- [`apiLogsGet`](docs/sdks/apilogs/README.md#get)
- [`apiLogsGetDir`](docs/sdks/apilogs/README.md#getdir)
- [`apiLogsGetSummary`](docs/sdks/apilogs/README.md#getsummary)
- [`apiLogsListSessions`](docs/sdks/apilogs/README.md#listsessions)
- [`apiLogsOpen`](docs/sdks/apilogs/README.md#open)
- [`authCreateCallback`](docs/sdks/auth/README.md#createcallback)
- [`authCreateLogin`](docs/sdks/auth/README.md#createlogin)
- [`authCreateLogout`](docs/sdks/auth/README.md#createlogout)
- [`authCreateRegister`](docs/sdks/auth/README.md#createregister)
- [`authGet`](docs/sdks/auth/README.md#get)
- [`authRefresh`](docs/sdks/auth/README.md#refresh)
- [`authValidate`](docs/sdks/auth/README.md#validate)
- [`browsePluginsDelete`](docs/sdks/browseplugins/README.md#delete)
- [`browsePluginsGet`](docs/sdks/browseplugins/README.md#get)
- [`browsePluginsInstall`](docs/sdks/browseplugins/README.md#install)
- [`browsePluginsListInstalled`](docs/sdks/browseplugins/README.md#listinstalled)
- [`browsePluginsListRegistry`](docs/sdks/browseplugins/README.md#listregistry)
- [`cacheDelete`](docs/sdks/cache/README.md#delete)
- [`cacheGetInfo`](docs/sdks/cache/README.md#getinfo)
- [`cacheGetSettings`](docs/sdks/cache/README.md#getsettings)
- [`cacheListOffline`](docs/sdks/cache/README.md#listoffline)
- [`cacheListShouldRefresh`](docs/sdks/cache/README.md#listshouldrefresh)
- [`cacheRefresh`](docs/sdks/cache/README.md#refresh)
- [`cacheUpdateSetting`](docs/sdks/cache/README.md#updatesetting)
- [`channelsCreate`](docs/sdks/channels/README.md#create)
- [`channelsCreateDefault`](docs/sdks/channels/README.md#createdefault)
- [`channelsCreateSendTest`](docs/sdks/channels/README.md#createsendtest)
- [`channelsCreateWebhook`](docs/sdks/channels/README.md#createwebhook)
- [`channelsCreateWebhook2`](docs/sdks/channels/README.md#createwebhook2)
- [`channelsDelete`](docs/sdks/channels/README.md#delete)
- [`channelsGet`](docs/sdks/channels/README.md#get) - Get a specific channel by ID
- [`channelsList`](docs/sdks/channels/README.md#list) - List all notification channels
- [`channelsSend`](docs/sdks/channels/README.md#send)
- [`channelsTest`](docs/sdks/channels/README.md#test)
- [`channelsUpdate`](docs/sdks/channels/README.md#update)
- [`chatListList`](docs/sdks/chatlist/README.md#list)
- [`clientToolsCreateComplete`](docs/sdks/clienttools/README.md#createcomplete)
- [`clientToolsCreateRequest`](docs/sdks/clienttools/README.md#createrequest)
- [`cliToolsCheck`](docs/sdks/clitools/README.md#check)
- [`cliToolsCreateConfig`](docs/sdks/clitools/README.md#createconfig)
- [`cliToolsDetect`](docs/sdks/clitools/README.md#detect)
- [`cliToolsGetConfig`](docs/sdks/clitools/README.md#getconfig)
- [`cliToolsUpdateConfig`](docs/sdks/clitools/README.md#updateconfig)
- [`collectionsCreate`](docs/sdks/collections/README.md#create)
- [`collectionsCreateComment`](docs/sdks/collections/README.md#createcomment)
- [`collectionsCreateFavorite`](docs/sdks/collections/README.md#createfavorite)
- [`collectionsCreateFork`](docs/sdks/collections/README.md#createfork)
- [`collectionsCreateItem`](docs/sdks/collections/README.md#createitem)
- [`collectionsDelete`](docs/sdks/collections/README.md#delete)
- [`collectionsDeleteItem`](docs/sdks/collections/README.md#deleteitem)
- [`collectionsGet`](docs/sdks/collections/README.md#get)
- [`collectionsGetComments`](docs/sdks/collections/README.md#getcomments)
- [`collectionsList`](docs/sdks/collections/README.md#list)
- [`collectionsUpdate`](docs/sdks/collections/README.md#update)
- [`commandQueueCancelItem`](docs/sdks/commandqueue/README.md#cancelitem)
- [`commandQueueClean`](docs/sdks/commandqueue/README.md#clean)
- [`commandQueueEnqueue`](docs/sdks/commandqueue/README.md#enqueue)
- [`commandQueueGetConfig`](docs/sdks/commandqueue/README.md#getconfig)
- [`commandQueueGetItem`](docs/sdks/commandqueue/README.md#getitem)
- [`commandQueueGetItemLogs`](docs/sdks/commandqueue/README.md#getitemlogs)
- [`commandQueueGetStatus`](docs/sdks/commandqueue/README.md#getstatus)
- [`commandQueueListItems`](docs/sdks/commandqueue/README.md#listitems)
- [`commandQueueRetryItem`](docs/sdks/commandqueue/README.md#retryitem)
- [`commandQueueUpdateConfig`](docs/sdks/commandqueue/README.md#updateconfig)
- [`commandsListSkills`](docs/sdks/commands/README.md#listskills)
- [`commandsListWorkspace`](docs/sdks/commands/README.md#listworkspace)
- [`cronCreate`](docs/sdks/cron/README.md#create)
- [`cronDelete`](docs/sdks/cron/README.md#delete)
- [`cronDeleteLogs`](docs/sdks/cron/README.md#deletelogs)
- [`cronDisable`](docs/sdks/cron/README.md#disable)
- [`cronEnable`](docs/sdks/cron/README.md#enable)
- [`cronGet`](docs/sdks/cron/README.md#get) - Get a specific cron job by ID
- [`cronGetLogs`](docs/sdks/cron/README.md#getlogs)
- [`cronList`](docs/sdks/cron/README.md#list) - List all cron jobs
- [`cronRun`](docs/sdks/cron/README.md#run)
- [`cronUpdate`](docs/sdks/cron/README.md#update)
- [`devicesCreateMessage`](docs/sdks/devices/README.md#createmessage)
- [`devicesDelete`](docs/sdks/devices/README.md#delete)
- [`devicesGet`](docs/sdks/devices/README.md#get)
- [`devicesGetQr`](docs/sdks/devices/README.md#getqr)
- [`devicesList`](docs/sdks/devices/README.md#list)
- [`eventsList`](docs/sdks/events/README.md#list)
- [`exchangesList`](docs/sdks/exchanges/README.md#list)
- [`executorsCreateOpenclawTestConnection`](docs/sdks/executors/README.md#createopenclawtestconnection) - Test connection to an OpenClaw gateway with device auth handshake
- [`executorsGetCommand`](docs/sdks/executors/README.md#getcommand)
- [`executorsGetCommands`](docs/sdks/executors/README.md#getcommands)
- [`executorsGetDiscoverSessions`](docs/sdks/executors/README.md#getdiscoversessions)
- [`executorsGetMcpServers`](docs/sdks/executors/README.md#getmcpservers)
- [`executorsGetPrompt`](docs/sdks/executors/README.md#getprompt)
- [`executorsGetPrompts`](docs/sdks/executors/README.md#getprompts)
- [`executorsGetSessionMessages`](docs/sdks/executors/README.md#getsessionmessages)
- [`executorsGetSkills`](docs/sdks/executors/README.md#getskills)
- [`executorsGetSubagent`](docs/sdks/executors/README.md#getsubagent)
- [`executorsGetSubagents`](docs/sdks/executors/README.md#getsubagents)
- [`executorsList`](docs/sdks/executors/README.md#list) - List available executors
- [`executorsListOpenclawRuntimeConfig`](docs/sdks/executors/README.md#listopenclawruntimeconfig) - Get the effective OpenClaw gateway config from the server side
- [`filesCopy`](docs/sdks/files/README.md#copy)
- [`filesCreate`](docs/sdks/files/README.md#create)
- [`filesCreateDirectory`](docs/sdks/files/README.md#createdirectory)
- [`filesCreateOpenFolder`](docs/sdks/files/README.md#createopenfolder)
- [`filesDelete`](docs/sdks/files/README.md#delete)
- [`filesGetGitStatus`](docs/sdks/files/README.md#getgitstatus)
- [`filesList`](docs/sdks/files/README.md#list)
- [`filesListConfigDir`](docs/sdks/files/README.md#listconfigdir)
- [`filesListContent`](docs/sdks/files/README.md#listcontent)
- [`filesListDirectory`](docs/sdks/files/README.md#listdirectory)
- [`filesListGitDiff`](docs/sdks/files/README.md#listgitdiff)
- [`filesMove`](docs/sdks/files/README.md#move)
- [`filesOpen`](docs/sdks/files/README.md#open)
- [`filesRename`](docs/sdks/files/README.md#rename)
- [`filesReveal`](docs/sdks/files/README.md#reveal)
- [`filesUpdateContent`](docs/sdks/files/README.md#updatecontent)
- [`githubAnalyzeIssue`](docs/sdks/github/README.md#analyzeissue)
- [`githubApproveAutofixTask`](docs/sdks/github/README.md#approveautofixtask)
- [`githubCancelAutofixTask`](docs/sdks/github/README.md#cancelautofixtask)
- [`githubClusterIssue`](docs/sdks/github/README.md#clusterissue)
- [`githubConnectRepo`](docs/sdks/github/README.md#connectrepo)
- [`githubConnectRepo2`](docs/sdks/github/README.md#connectrepo2)
- [`githubCreateAuthGhCli`](docs/sdks/github/README.md#createauthghcli)
- [`githubCreateAuthPat`](docs/sdks/github/README.md#createauthpat)
- [`githubCreateAutofixTask`](docs/sdks/github/README.md#createautofixtask)
- [`githubCreatePr`](docs/sdks/github/README.md#createpr)
- [`githubCreateRelease`](docs/sdks/github/README.md#createrelease)
- [`githubCreateReleaseGenerateNote`](docs/sdks/github/README.md#createreleasegeneratenote)
- [`githubDeleteAuth`](docs/sdks/github/README.md#deleteauth)
- [`githubDeleteAutofixTask`](docs/sdks/github/README.md#deleteautofixtask)
- [`githubDeleteAutofixWorktrees`](docs/sdks/github/README.md#deleteautofixworktrees)
- [`githubDetectRepo`](docs/sdks/github/README.md#detectrepo)
- [`githubGetAuthStatus`](docs/sdks/github/README.md#getauthstatus)
- [`githubGetAutofixConfig`](docs/sdks/github/README.md#getautofixconfig)
- [`githubGetAutofixTask`](docs/sdks/github/README.md#getautofixtask)
- [`githubGetIssue`](docs/sdks/github/README.md#getissue)
- [`githubGetIssueComments`](docs/sdks/github/README.md#getissuecomments)
- [`githubGetPr`](docs/sdks/github/README.md#getpr)
- [`githubGetReleaseLatest`](docs/sdks/github/README.md#getreleaselatest)
- [`githubImportIssue`](docs/sdks/github/README.md#importissue)
- [`githubInvestigateIssue`](docs/sdks/github/README.md#investigateissue)
- [`githubListAutofixTasks`](docs/sdks/github/README.md#listautofixtasks)
- [`githubListAutofixWorktrees`](docs/sdks/github/README.md#listautofixworktrees)
- [`githubListIssues`](docs/sdks/github/README.md#listissues)
- [`githubListPrs`](docs/sdks/github/README.md#listprs)
- [`githubListReleases`](docs/sdks/github/README.md#listreleases)
- [`githubListRepos`](docs/sdks/github/README.md#listrepos)
- [`githubListReposConnected`](docs/sdks/github/README.md#listreposconnected)
- [`githubTriageIssue`](docs/sdks/github/README.md#triageissue)
- [`githubUpdateAutofixConfig`](docs/sdks/github/README.md#updateautofixconfig)
- [`groupChatsCreate`](docs/sdks/groupchats/README.md#create)
- [`groupChatsCreateFile`](docs/sdks/groupchats/README.md#createfile)
- [`groupChatsCreateMember`](docs/sdks/groupchats/README.md#createmember)
- [`groupChatsCreatePicture`](docs/sdks/groupchats/README.md#createpicture)
- [`groupChatsCreateSession`](docs/sdks/groupchats/README.md#createsession)
- [`groupChatsCreateSessionMessage`](docs/sdks/groupchats/README.md#createsessionmessage)
- [`groupChatsDelete`](docs/sdks/groupchats/README.md#delete)
- [`groupChatsDeleteFile`](docs/sdks/groupchats/README.md#deletefile)
- [`groupChatsDeleteMember`](docs/sdks/groupchats/README.md#deletemember)
- [`groupChatsDeletePicture`](docs/sdks/groupchats/README.md#deletepicture)
- [`groupChatsDeleteSession`](docs/sdks/groupchats/README.md#deletesession)
- [`groupChatsGet`](docs/sdks/groupchats/README.md#get)
- [`groupChatsGetFile`](docs/sdks/groupchats/README.md#getfile)
- [`groupChatsGetFiles`](docs/sdks/groupchats/README.md#getfiles)
- [`groupChatsGetMembers`](docs/sdks/groupchats/README.md#getmembers)
- [`groupChatsGetPicture`](docs/sdks/groupchats/README.md#getpicture)
- [`groupChatsGetPictures`](docs/sdks/groupchats/README.md#getpictures)
- [`groupChatsGetSession`](docs/sdks/groupchats/README.md#getsession)
- [`groupChatsGetSessionAgents`](docs/sdks/groupchats/README.md#getsessionagents)
- [`groupChatsGetSessionMessages`](docs/sdks/groupchats/README.md#getsessionmessages)
- [`groupChatsGetSessions`](docs/sdks/groupchats/README.md#getsessions)
- [`groupChatsList`](docs/sdks/groupchats/README.md#list)
- [`groupChatsUpdate`](docs/sdks/groupchats/README.md#update)
- [`groupChatsUpdateSession`](docs/sdks/groupchats/README.md#updatesession)
- [`historyCreate`](docs/sdks/history/README.md#create)
- [`historyDelete`](docs/sdks/history/README.md#delete)
- [`historyDelete2`](docs/sdks/history/README.md#delete2)
- [`historyGet`](docs/sdks/history/README.md#get)
- [`historyList`](docs/sdks/history/README.md#list)
- [`ideasCreate`](docs/sdks/ideas/README.md#create) - Create a new custom idea type
- [`ideasCreateDismiss`](docs/sdks/ideas/README.md#createdismiss) - Dismiss an idea (mark as not worth pursuing)
- [`ideasDelete`](docs/sdks/ideas/README.md#delete) - Remove a single idea by ID
- [`ideasDelete2`](docs/sdks/ideas/README.md#delete2) - Remove ideas by type or all ideas
- [`ideasDelete3`](docs/sdks/ideas/README.md#delete3) - Delete a custom idea type
- [`ideasGenerate`](docs/sdks/ideas/README.md#generate) - Generate ideas by analyzing the codebase using AI
- [`ideasGet`](docs/sdks/ideas/README.md#get) - Get a specific idea by ID
- [`ideasList`](docs/sdks/ideas/README.md#list) - List all ideas for a workspace with optional filtering
- [`ideasList2`](docs/sdks/ideas/README.md#list2) - List available idea types (builtin + custom)
- [`ideasPromote`](docs/sdks/ideas/README.md#promote) - Promote an idea to a task
- [`ideasUpdate`](docs/sdks/ideas/README.md#update) - Update an existing idea type
- [`inputHistoryList`](docs/sdks/inputhistory/README.md#list)
- [`kanbanCreateTaskActivity`](docs/sdks/kanban/README.md#createtaskactivity)
- [`kanbanCreateTaskComment`](docs/sdks/kanban/README.md#createtaskcomment)
- [`kanbanCreateTaskCommentReaction`](docs/sdks/kanban/README.md#createtaskcommentreaction)
- [`kanbanDeleteTaskComment`](docs/sdks/kanban/README.md#deletetaskcomment)
- [`kanbanDeleteTaskData`](docs/sdks/kanban/README.md#deletetaskdata)
- [`kanbanGetTaskActivities`](docs/sdks/kanban/README.md#gettaskactivities) - Get all activities for a task
- [`kanbanGetTaskComments`](docs/sdks/kanban/README.md#gettaskcomments) - Get all comments for a task
- [`kanbanUpdateTaskComment`](docs/sdks/kanban/README.md#updatetaskcomment)
- [`logsAdd`](docs/sdks/logs/README.md#add)
- [`logsCleanup`](docs/sdks/logs/README.md#cleanup)
- [`logsDelete`](docs/sdks/logs/README.md#delete)
- [`logsDeleteSession`](docs/sdks/logs/README.md#deletesession)
- [`logsExportSession`](docs/sdks/logs/README.md#exportsession)
- [`logsGetDir`](docs/sdks/logs/README.md#getdir)
- [`logsGetSession`](docs/sdks/logs/README.md#getsession)
- [`logsInit`](docs/sdks/logs/README.md#init)
- [`logsListSessions`](docs/sdks/logs/README.md#listsessions)
- [`marketplaceDeleteCache`](docs/sdks/marketplace/README.md#deletecache)
- [`marketplaceGetCategoryPlugins`](docs/sdks/marketplace/README.md#getcategoryplugins)
- [`marketplaceGetPlugin`](docs/sdks/marketplace/README.md#getplugin)
- [`marketplaceListCategories`](docs/sdks/marketplace/README.md#listcategories)
- [`marketplaceListIndex`](docs/sdks/marketplace/README.md#listindex)
- [`marketplaceListPlugins`](docs/sdks/marketplace/README.md#listplugins)
- [`marketplaceListSources`](docs/sdks/marketplace/README.md#listsources)
- [`marketplaceSearch`](docs/sdks/marketplace/README.md#search)
- [`mcpCreateAgentServer`](docs/sdks/mcp/README.md#createagentserver)
- [`mcpCreateInspectorMcp`](docs/sdks/mcp/README.md#createinspectormcp)
- [`mcpCreateInspectorMessage`](docs/sdks/mcp/README.md#createinspectormessage)
- [`mcpCreateInspectorSse`](docs/sdks/mcp/README.md#createinspectorsse)
- [`mcpCreatePortStatu`](docs/sdks/mcp/README.md#createportstatu)
- [`mcpCreateProcessAlive`](docs/sdks/mcp/README.md#createprocessalive)
- [`mcpDeleteAgentServer`](docs/sdks/mcp/README.md#deleteagentserver)
- [`mcpDeleteInspectorMcp`](docs/sdks/mcp/README.md#deleteinspectormcp)
- [`mcpDeleteInspectorSession`](docs/sdks/mcp/README.md#deleteinspectorsession)
- [`mcpDisableAgentServer`](docs/sdks/mcp/README.md#disableagentserver)
- [`mcpDownload`](docs/sdks/mcp/README.md#download) - Download MCP package to a directory
- [`mcpEnableAgentServer`](docs/sdks/mcp/README.md#enableagentserver)
- [`mcpGetAgentServer`](docs/sdks/mcp/README.md#getagentserver)
- [`mcpGetAgentServers`](docs/sdks/mcp/README.md#getagentservers)
- [`mcpGetInfo`](docs/sdks/mcp/README.md#getinfo) - Get MCP package details from marketplace
- [`mcpGetInspectorConfig`](docs/sdks/mcp/README.md#getinspectorconfig)
- [`mcpGetInspectorHealth`](docs/sdks/mcp/README.md#getinspectorhealth)
- [`mcpGetInspectorToken`](docs/sdks/mcp/README.md#getinspectortoken)
- [`mcpInstall`](docs/sdks/mcp/README.md#install) - Install an MCP package (supports name, name@version, gh:user/repo, ./path)
- [`mcpKillProcess`](docs/sdks/mcp/README.md#killprocess)
- [`mcpList`](docs/sdks/mcp/README.md#list) - List installed MCP packages
- [`mcpListInspectorMcp`](docs/sdks/mcp/README.md#listinspectormcp)
- [`mcpListInspectorSessions`](docs/sdks/mcp/README.md#listinspectorsessions)
- [`mcpListInspectorSse`](docs/sdks/mcp/README.md#listinspectorsse)
- [`mcpListInspectorStdio`](docs/sdks/mcp/README.md#listinspectorstdio)
- [`mcpListInstalled`](docs/sdks/mcp/README.md#listinstalled) - List globally installed MCP servers
- [`mcpMarketCreateComment`](docs/sdks/mcpmarket/README.md#createcomment)
- [`mcpMarketCreateFavorite`](docs/sdks/mcpmarket/README.md#createfavorite)
- [`mcpMarketCreateRating`](docs/sdks/mcpmarket/README.md#createrating)
- [`mcpMarketDownload`](docs/sdks/mcpmarket/README.md#download)
- [`mcpMarketGet`](docs/sdks/mcpmarket/README.md#get)
- [`mcpMarketGetComments`](docs/sdks/mcpmarket/README.md#getcomments)
- [`mcpMarketList`](docs/sdks/mcpmarket/README.md#list)
- [`mcpMarketListCategories`](docs/sdks/mcpmarket/README.md#listcategories)
- [`mcpMarketSearch`](docs/sdks/mcpmarket/README.md#search)
- [`mcpSearch`](docs/sdks/mcp/README.md#search) - Search MCP packages in marketplace
- [`mcpShow`](docs/sdks/mcp/README.md#show) - Get MCP package details
- [`mcpUninstall`](docs/sdks/mcp/README.md#uninstall) - Uninstall an MCP package
- [`mcpUpdateAgentServer`](docs/sdks/mcp/README.md#updateagentserver)
- [`meshConnect`](docs/sdks/mesh/README.md#connect)
- [`meshListPeers`](docs/sdks/mesh/README.md#listpeers)
- [`modelsCreate`](docs/sdks/models/README.md#create)
- [`modelsCreateAlias`](docs/sdks/models/README.md#createalias)
- [`modelsDelete`](docs/sdks/models/README.md#delete)
- [`modelsDeleteAlias`](docs/sdks/models/README.md#deletealias)
- [`modelsDeleteConfig`](docs/sdks/models/README.md#deleteconfig)
- [`modelsDisable`](docs/sdks/models/README.md#disable)
- [`modelsEnable`](docs/sdks/models/README.md#enable)
- [`modelsGet`](docs/sdks/models/README.md#get) - Get a specific model by ID
- [`modelsGetConfig`](docs/sdks/models/README.md#getconfig)
- [`modelsGetDefault`](docs/sdks/models/README.md#getdefault)
- [`modelsList`](docs/sdks/models/README.md#list) - List all models
- [`modelsListAliases`](docs/sdks/models/README.md#listaliases)
- [`modelsReload`](docs/sdks/models/README.md#reload)
- [`modelsUpdate`](docs/sdks/models/README.md#update)
- [`modelsUpdateConfig`](docs/sdks/models/README.md#updateconfig)
- [`modelsUpdateDefault`](docs/sdks/models/README.md#updatedefault)
- [`officialRegistryDeleteCache`](docs/sdks/officialregistry/README.md#deletecache)
- [`officialRegistryDeleteServerCache`](docs/sdks/officialregistry/README.md#deleteservercache)
- [`officialRegistryGetServer`](docs/sdks/officialregistry/README.md#getserver)
- [`officialRegistryGetServerVersions`](docs/sdks/officialregistry/README.md#getserverversions)
- [`officialRegistryListServers`](docs/sdks/officialregistry/README.md#listservers)
- [`packagesCreateUpdate`](docs/sdks/packages/README.md#createupdate)
- [`packagesListInstalled`](docs/sdks/packages/README.md#listinstalled)
- [`packagesListMcp`](docs/sdks/packages/README.md#listmcp)
- [`packagesListSkills`](docs/sdks/packages/README.md#listskills)
- [`pageCreateApplyTemplate`](docs/sdks/page/README.md#createapplytemplate) - Apply a page template to an empty markdown page
- [`pageCreateCreate`](docs/sdks/page/README.md#createcreate) - Create a new page
- [`pageCreateDelete`](docs/sdks/page/README.md#createdelete) - Delete a page
- [`pageCreatePublish`](docs/sdks/page/README.md#createpublish)
- [`pageCreatePublishHistory`](docs/sdks/page/README.md#createpublishhistory)
- [`pageCreatePublishRollback`](docs/sdks/page/README.md#createpublishrollback)
- [`pageCreatePublishStatu`](docs/sdks/page/README.md#createpublishstatu)
- [`pageCreatePublishVersion`](docs/sdks/page/README.md#createpublishversion)
- [`pageCreateTemplate`](docs/sdks/page/README.md#createtemplate) - List available page templates
- [`pageCreateUpdateConfig`](docs/sdks/page/README.md#createupdateconfig) - Update page config (name, description, icon, cover, page_width, show_toc)
- [`pageCreateUpdateContent`](docs/sdks/page/README.md#createupdatecontent) - Update page markdown content (preserves YAML frontmatter)
- [`pageDuplicate`](docs/sdks/page/README.md#duplicate) - Duplicate a page (copy all files with a new uid)
- [`pageGetSDKV1VibenPageSDK`](docs/sdks/page/README.md#getsdkv1vibenpagesdk) - Serve viben-page-sdk.js
- [`pageGetSDKV1VibenPageTokens`](docs/sdks/page/README.md#getsdkv1vibenpagetokens) - Serve viben-page-tokens.css
- [`pageList`](docs/sdks/page/README.md#list) - List pages in workspace
- [`pageReorder`](docs/sdks/page/README.md#reorder) - Reorder pages within a parent level
- [`pageServe`](docs/sdks/page/README.md#serve) - Serve page content
- [`pageServe2`](docs/sdks/page/README.md#serve2) - Serve page content
- [`pageUploadAsset`](docs/sdks/page/README.md#uploadasset)
- [`pageView`](docs/sdks/page/README.md#view) - Get page by uid
- [`patchesList`](docs/sdks/patches/README.md#list)
- [`petAddSource`](docs/sdks/pet/README.md#addsource)
- [`petExport`](docs/sdks/pet/README.md#export)
- [`petGetAsset`](docs/sdks/pet/README.md#getasset)
- [`petGetCommunity`](docs/sdks/pet/README.md#getcommunity)
- [`petGetConfig`](docs/sdks/pet/README.md#getconfig)
- [`petGetPreview`](docs/sdks/pet/README.md#getpreview)
- [`petImport`](docs/sdks/pet/README.md#import)
- [`petInstall`](docs/sdks/pet/README.md#install)
- [`petList`](docs/sdks/pet/README.md#list)
- [`petListSources`](docs/sdks/pet/README.md#listsources)
- [`petRemove`](docs/sdks/pet/README.md#remove)
- [`petRemoveSource`](docs/sdks/pet/README.md#removesource)
- [`petSearch`](docs/sdks/pet/README.md#search)
- [`petSet`](docs/sdks/pet/README.md#set)
- [`petShow`](docs/sdks/pet/README.md#show)
- [`petUpdateConfig`](docs/sdks/pet/README.md#updateconfig)
- [`preferencesList`](docs/sdks/preferences/README.md#list)
- [`preferencesListDeveloper`](docs/sdks/preferences/README.md#listdeveloper)
- [`preferencesListDeveloperIde`](docs/sdks/preferences/README.md#listdeveloperide)
- [`preferencesListDeveloperTerminal`](docs/sdks/preferences/README.md#listdeveloperterminal)
- [`preferencesListNotifications`](docs/sdks/preferences/README.md#listnotifications)
- [`preferencesUpdate`](docs/sdks/preferences/README.md#update)
- [`preferencesUpdateDeveloper`](docs/sdks/preferences/README.md#updatedeveloper)
- [`preferencesUpdateDeveloperIde`](docs/sdks/preferences/README.md#updatedeveloperide)
- [`preferencesUpdateDeveloperTerminal`](docs/sdks/preferences/README.md#updatedeveloperterminal)
- [`preferencesUpdateNotification`](docs/sdks/preferences/README.md#updatenotification)
- [`previewCreateKillPort`](docs/sdks/preview/README.md#createkillport) - Kill the process occupying a specific port
- [`previewCreateStopAll`](docs/sdks/preview/README.md#createstopall) - Stop all running preview servers
- [`previewGetStatu`](docs/sdks/preview/README.md#getstatu) - Get status of a preview server
- [`previewList`](docs/sdks/preview/README.md#list) - List all active preview servers
- [`previewListNodeAvailable`](docs/sdks/preview/README.md#listnodeavailable) - Check if Node.js is available for Live Preview
- [`previewListStartSse`](docs/sdks/preview/README.md#liststartsse) - Start a Vite preview server with SSE streaming for real-time feedback
- [`previewStart`](docs/sdks/preview/README.md#start) - Start a Vite preview server for a task
- [`previewStop`](docs/sdks/preview/README.md#stop) - Stop a Vite preview server
- [`providersCreate`](docs/sdks/providers/README.md#create)
- [`providersCreateValidateKey`](docs/sdks/providers/README.md#createvalidatekey)
- [`providersDelete`](docs/sdks/providers/README.md#delete)
- [`providersDisable`](docs/sdks/providers/README.md#disable)
- [`providersDisableModel`](docs/sdks/providers/README.md#disablemodel)
- [`providersEnable`](docs/sdks/providers/README.md#enable)
- [`providersEnableModel`](docs/sdks/providers/README.md#enablemodel)
- [`providersGet`](docs/sdks/providers/README.md#get) - Get a specific provider by ID
- [`providersGetDefault`](docs/sdks/providers/README.md#getdefault)
- [`providersGetDiscoverModels`](docs/sdks/providers/README.md#getdiscovermodels)
- [`providersGetModels`](docs/sdks/providers/README.md#getmodels)
- [`providersList`](docs/sdks/providers/README.md#list) - List all providers
- [`providersListApiKeys`](docs/sdks/providers/README.md#listapikeys)
- [`providersListApiKeysAll`](docs/sdks/providers/README.md#listapikeysall)
- [`providersReload`](docs/sdks/providers/README.md#reload)
- [`providersTest`](docs/sdks/providers/README.md#test)
- [`providersUpdate`](docs/sdks/providers/README.md#update)
- [`providersUpdateDefault`](docs/sdks/providers/README.md#updatedefault)
- [`pythonCheck`](docs/sdks/python/README.md#check)
- [`pythonCheckPackage`](docs/sdks/python/README.md#checkpackage)
- [`pythonCreatePackageInstallCommand`](docs/sdks/python/README.md#createpackageinstallcommand)
- [`pythonDetect`](docs/sdks/python/README.md#detect)
- [`queueCreateClearHistory`](docs/sdks/queue/README.md#createclearhistory)
- [`queueCreateEnqueueBatch`](docs/sdks/queue/README.md#createenqueuebatch)
- [`queueDeleteTask`](docs/sdks/queue/README.md#deletetask)
- [`queueEnqueue`](docs/sdks/queue/README.md#enqueue)
- [`queueGetConfig`](docs/sdks/queue/README.md#getconfig)
- [`queueGetStatus`](docs/sdks/queue/README.md#getstatus)
- [`queueGetTask`](docs/sdks/queue/README.md#gettask)
- [`queueGetTaskRunning`](docs/sdks/queue/README.md#gettaskrunning)
- [`queueGetTaskStream`](docs/sdks/queue/README.md#gettaskstream)
- [`queueListTasks`](docs/sdks/queue/README.md#listtasks)
- [`queueRetryTask`](docs/sdks/queue/README.md#retrytask)
- [`queueUpdateConfig`](docs/sdks/queue/README.md#updateconfig)
- [`rewardCompute`](docs/sdks/reward/README.md#compute) - Compute reward for a task by spawning the reward agent
- [`rewardCreateType`](docs/sdks/reward/README.md#createtype) - Create a new custom reward type
- [`rewardDeleteType`](docs/sdks/reward/README.md#deletetype) - Delete a custom reward type
- [`rewardGetType`](docs/sdks/reward/README.md#gettype) - Get a specific reward type by name
- [`rewardListTypes`](docs/sdks/reward/README.md#listtypes) - List available reward types (builtin + custom)
- [`rewardSelect`](docs/sdks/reward/README.md#select) - Select best task using PPO metrics
- [`rewardUpdateType`](docs/sdks/reward/README.md#updatetype) - Update a custom reward type
- [`sandboxCreateExec`](docs/sdks/sandbox/README.md#createexec)
- [`sandboxCreateRunFile`](docs/sdks/sandbox/README.md#createrunfile)
- [`sandboxGetAvailable`](docs/sdks/sandbox/README.md#getavailable)
- [`sandboxStop`](docs/sdks/sandbox/README.md#stop)
- [`serviceKeysCreate`](docs/sdks/servicekeys/README.md#create)
- [`serviceKeysCreateUsage`](docs/sdks/servicekeys/README.md#createusage)
- [`serviceKeysDelete`](docs/sdks/servicekeys/README.md#delete)
- [`serviceKeysGet`](docs/sdks/servicekeys/README.md#get)
- [`serviceKeysList`](docs/sdks/servicekeys/README.md#list)
- [`serviceKeysUpdate`](docs/sdks/servicekeys/README.md#update)
- [`serviceKeysValidate`](docs/sdks/servicekeys/README.md#validate)
- [`sessionsCreate`](docs/sdks/sessions/README.md#create)
- [`sessionsDelete`](docs/sdks/sessions/README.md#delete)
- [`sessionsGet`](docs/sdks/sessions/README.md#get) - Get a specific session by ID
- [`sessionsGetMessages`](docs/sdks/sessions/README.md#getmessages)
- [`sessionsGetUiMessages`](docs/sdks/sessions/README.md#getuimessages)
- [`sessionsList`](docs/sdks/sessions/README.md#list) - List all sessions
- [`sessionsUpdate`](docs/sdks/sessions/README.md#update)
- [`skillCreateFavorite`](docs/sdks/skill/README.md#createfavorite) - Toggle favorite for a marketplace skill
- [`skillDisable`](docs/sdks/skill/README.md#disable) - Disable a skill for an agent
- [`skillDownload`](docs/sdks/skill/README.md#download) - Download skill package to a directory
- [`skillEnable`](docs/sdks/skill/README.md#enable) - Enable a skill for an agent
- [`skillGetAvailable`](docs/sdks/skill/README.md#getavailable) - List available skills from marketplace
- [`skillGetInfo`](docs/sdks/skill/README.md#getinfo) - Get skill package details from marketplace
- [`skillInstall`](docs/sdks/skill/README.md#install) - Install a skill
- [`skillList`](docs/sdks/skill/README.md#list) - List installed skills
- [`skillListClawhubPackages`](docs/sdks/skill/README.md#listclawhubpackages) - List ClaWHub skill packages
- [`skillListEnabled`](docs/sdks/skill/README.md#listenabled) - Get enabled skills for an agent
- [`skillMarketCreateComment`](docs/sdks/skillmarket/README.md#createcomment)
- [`skillMarketCreateFavorite`](docs/sdks/skillmarket/README.md#createfavorite)
- [`skillMarketCreateRating`](docs/sdks/skillmarket/README.md#createrating)
- [`skillMarketDownload`](docs/sdks/skillmarket/README.md#download)
- [`skillMarketGet`](docs/sdks/skillmarket/README.md#get)
- [`skillMarketGetComments`](docs/sdks/skillmarket/README.md#getcomments)
- [`skillMarketList`](docs/sdks/skillmarket/README.md#list)
- [`skillMarketListCategories`](docs/sdks/skillmarket/README.md#listcategories)
- [`skillMarketSearch`](docs/sdks/skillmarket/README.md#search)
- [`skillSearch`](docs/sdks/skill/README.md#search) - Search skill packages in marketplace
- [`skillSearchClawhub`](docs/sdks/skill/README.md#searchclawhub) - Search ClaWHub skill packages
- [`skillUninstall`](docs/sdks/skill/README.md#uninstall) - Uninstall a skill
- [`skillView`](docs/sdks/skill/README.md#view) - Get skill by name
- [`systemGetInfo`](docs/sdks/system/README.md#getinfo)
- [`systemListPublicIp`](docs/sdks/system/README.md#listpublicip)
- [`tasksApprove`](docs/sdks/tasks/README.md#approve) - Approve a task in review: review -> completed
- [`tasksArchive`](docs/sdks/tasks/README.md#archive) - Archive a completed task: completed -> archived
- [`tasksCancel`](docs/sdks/tasks/README.md#cancel) - Cancel a task: * -> cancelled (terminal state)
- [`tasksCleanup`](docs/sdks/tasks/README.md#cleanup) - Cleanup worktrees and related resources
- [`tasksCreate`](docs/sdks/tasks/README.md#create)
- [`tasksCreateAddContext`](docs/sdks/tasks/README.md#createaddcontext) - Add context files to a task
- [`tasksCreateAddSession`](docs/sdks/tasks/README.md#createaddsession) - Add a new session to journal file and update index.md
- [`tasksCreateBatchEnqueue`](docs/sdks/tasks/README.md#createbatchenqueue) - Batch enqueue multiple tasks for execution
- [`tasksCreateBatchEvent`](docs/sdks/tasks/README.md#createbatchevent) - Apply an event to multiple tasks (batch operation)
- [`tasksCreateCheckPhase`](docs/sdks/tasks/README.md#createcheckphase) - Run check phase for a task (spawns check agent)
- [`tasksCreateClearHistory`](docs/sdks/tasks/README.md#createclearhistory) - Clear completed and failed tasks from queue history
- [`tasksCreateContext`](docs/sdks/tasks/README.md#createcontext) - Get session context for AI agents
- [`tasksCreateCreate`](docs/sdks/tasks/README.md#createcreate) - Create a new task
- [`tasksCreateCreatePr`](docs/sdks/tasks/README.md#createcreatepr) - Create PR from task
- [`tasksCreateCreateWorktree`](docs/sdks/tasks/README.md#createcreateworktree) - Create isolated git worktree for a task
- [`tasksCreateDelete`](docs/sdks/tasks/README.md#createdelete) - Delete a task
- [`tasksCreateEvent`](docs/sdks/tasks/README.md#createevent) - Get event history for a task
- [`tasksCreateEvent2`](docs/sdks/tasks/README.md#createevent2)
- [`tasksCreateFinish`](docs/sdks/tasks/README.md#createfinish) - Finish a task: clear current task marker
- [`tasksCreateImplementPhase`](docs/sdks/tasks/README.md#createimplementphase) - Run implement phase for a task (spawns implement agent)
- [`tasksCreateInitContext`](docs/sdks/tasks/README.md#createinitcontext) - Initialize empty context files (implement.jsonl, check.jsonl, fix.jsonl) for a task. Use add-context to add specific files.
- [`tasksCreateListContext`](docs/sdks/tasks/README.md#createlistcontext) - List all context entries for a task
- [`tasksCreatePlan`](docs/sdks/tasks/README.md#createplan) - Start Plan Agent to plan a task
- [`tasksCreatePlanPhase`](docs/sdks/tasks/README.md#createplanphase) - Run plan phase for a task (spawns plan agent)
- [`tasksCreateQueueConfig`](docs/sdks/tasks/README.md#createqueueconfig) - Get or update queue configuration
- [`tasksCreateQueueStatu`](docs/sdks/tasks/README.md#createqueuestatu) - Get queue status
- [`tasksCreateRemoveContext`](docs/sdks/tasks/README.md#createremovecontext) - Remove context files from a task
- [`tasksCreateReview`](docs/sdks/tasks/README.md#createreview) - View task details for review
- [`tasksCreateRunning`](docs/sdks/tasks/README.md#createrunning) - Check if task execution is running
- [`tasksCreateSetAgent`](docs/sdks/tasks/README.md#createsetagent) - Set associated agent configuration for a task
- [`tasksCreateSetBase`](docs/sdks/tasks/README.md#createsetbase) - Set PR target branch for a task
- [`tasksCreateSetBranch`](docs/sdks/tasks/README.md#createsetbranch) - Set Git branch for a task
- [`tasksCreateSpec`](docs/sdks/tasks/README.md#createspec) - Get task specs (PRD, subtasks, logs)
- [`tasksCreateStatu`](docs/sdks/tasks/README.md#createstatu) - Get task status summary or details
- [`tasksCreateUpdate`](docs/sdks/tasks/README.md#createupdate) - Update task fields (not status - use lifecycle endpoints for status changes)
- [`tasksCreateValidateCheckPhasePassed`](docs/sdks/tasks/README.md#createvalidatecheckphasepassed) - Validate check phase passed (runs verify commands or checks completion markers)
- [`tasksCreateValidateContext`](docs/sdks/tasks/README.md#createvalidatecontext) - Validate that all context file references exist
- [`tasksCreateWorkPhase`](docs/sdks/tasks/README.md#createworkphase) - Run work phase for a task (spawns work agent)
- [`tasksDelete`](docs/sdks/tasks/README.md#delete)
- [`tasksDequeue`](docs/sdks/tasks/README.md#dequeue) - Remove task from queue back to backlog
- [`tasksEnqueue`](docs/sdks/tasks/README.md#enqueue) - Move task from backlog to queue for execution
- [`tasksExecute`](docs/sdks/tasks/README.md#execute) - Trigger task execution via queue system
- [`tasksGet`](docs/sdks/tasks/README.md#get) - Get a specific task by ID
- [`tasksGetEvents`](docs/sdks/tasks/README.md#getevents)
- [`tasksGetEventStream`](docs/sdks/tasks/README.md#geteventstream)
- [`tasksGetRunning`](docs/sdks/tasks/README.md#getrunning) - Check if a task's execution process is currently running
- [`tasksGetSessions`](docs/sdks/tasks/README.md#getsessions)
- [`tasksGetSpecs`](docs/sdks/tasks/README.md#getspecs) - Get task specs data (PRD, subtasks, logs, files)
- [`tasksGetState`](docs/sdks/tasks/README.md#getstate)
- [`tasksList`](docs/sdks/tasks/README.md#list) - List all tasks for a workspace (workspace_path required)
- [`tasksList2`](docs/sdks/tasks/README.md#list2) - List tasks
- [`tasksListEventsStream`](docs/sdks/tasks/README.md#listeventsstream) - SSE stream for task events
- [`tasksListEventsStream2`](docs/sdks/tasks/README.md#listeventsstream2)
- [`tasksListExecutionStream`](docs/sdks/tasks/README.md#listexecutionstream) - SSE stream for task execution progress
- [`tasksListListArchive`](docs/sdks/tasks/README.md#listlistarchive) - List archived tasks
- [`tasksPause`](docs/sdks/tasks/README.md#pause) - Pause a task: in_progress/queue -> paused (saves pausedSnapshot)
- [`tasksReject`](docs/sdks/tasks/README.md#reject) - Reject a task in review: review -> backlog
- [`tasksResume`](docs/sdks/tasks/README.md#resume) - Resume a paused task: paused -> queue/in_progress
- [`tasksRetry`](docs/sdks/tasks/README.md#retry) - Retry a failed task: failed -> queue
- [`tasksStart`](docs/sdks/tasks/README.md#start) - Start a task: set as current task, queue -> in_progress, optionally trigger execution
- [`tasksStop`](docs/sdks/tasks/README.md#stop) - Stop task execution
- [`tasksUpdate`](docs/sdks/tasks/README.md#update)
- [`tasksUpdate2`](docs/sdks/tasks/README.md#update2)
- [`tasksValidateEvent`](docs/sdks/tasks/README.md#validateevent)
- [`tasksView`](docs/sdks/tasks/README.md#view) - View task details
- [`telemetryClean`](docs/sdks/telemetry/README.md#clean)
- [`telemetryGetTrace`](docs/sdks/telemetry/README.md#gettrace)
- [`telemetryGetTraceSpans`](docs/sdks/telemetry/README.md#gettracespans)
- [`telemetryListDates`](docs/sdks/telemetry/README.md#listdates)
- [`telemetryListStats`](docs/sdks/telemetry/README.md#liststats)
- [`telemetryListTraces`](docs/sdks/telemetry/README.md#listtraces)
- [`tunnelGetStatus`](docs/sdks/tunnel/README.md#getstatus)
- [`tunnelRestart`](docs/sdks/tunnel/README.md#restart)
- [`tunnelStart`](docs/sdks/tunnel/README.md#start)
- [`tunnelStop`](docs/sdks/tunnel/README.md#stop)
- [`userCreateMeApiKey`](docs/sdks/user/README.md#createmeapikey)
- [`userDeleteMeApiKey`](docs/sdks/user/README.md#deletemeapikey)
- [`userGet`](docs/sdks/user/README.md#get)
- [`userListMe`](docs/sdks/user/README.md#listme)
- [`userListMeApiKeys`](docs/sdks/user/README.md#listmeapikeys)
- [`userListMeFavorites`](docs/sdks/user/README.md#listmefavorites)
- [`userUpdateMe`](docs/sdks/user/README.md#updateme)
- [`voiceCreateToken`](docs/sdks/voice/README.md#createtoken)
- [`workspacesCreateCreate`](docs/sdks/workspaces/README.md#createcreate)
- [`workspacesDelete`](docs/sdks/workspaces/README.md#delete)
- [`workspacesDetect`](docs/sdks/workspaces/README.md#detect) - Detect folder status (.git and .viben directories)
- [`workspacesList`](docs/sdks/workspaces/README.md#list) - List all workspaces including the global workspace

</details>
<!-- End Standalone functions [standalone-funcs] -->

<!-- Start Retries [retries] -->
## Retries

Some of the endpoints in this SDK support retries.  If you use the SDK without any configuration, it will fall back to the default retry strategy provided by the API.  However, the default retry strategy can be overridden on a per-operation basis, or across the entire SDK.

To change the default retry strategy for a single API call, simply provide a retryConfig object to the call:
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient();

async function run() {
  const result = await vibenClient.agent.list(undefined, {
    retries: {
      strategy: "backoff",
      backoff: {
        initialInterval: 1,
        maxInterval: 50,
        exponent: 1.1,
        maxElapsedTime: 100,
      },
      retryConnectionErrors: false,
    },
  });

  console.log(result);
}

run();

```

If you'd like to override the default retry strategy for all operations that support retries, you can provide a retryConfig at SDK initialization:
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient({
  retryConfig: {
    strategy: "backoff",
    backoff: {
      initialInterval: 1,
      maxInterval: 50,
      exponent: 1.1,
      maxElapsedTime: 100,
    },
    retryConnectionErrors: false,
  },
});

async function run() {
  const result = await vibenClient.agent.list();

  console.log(result);
}

run();

```
<!-- End Retries [retries] -->

<!-- Start Error Handling [errors] -->
## Error Handling

[`SDKBaseError`](./src/sdk/models/errors/sdkbaseerror.ts) is the base class for all HTTP error responses. It has the following properties:

| Property            | Type       | Description                                            |
| ------------------- | ---------- | ------------------------------------------------------ |
| `error.message`     | `string`   | Error message                                          |
| `error.statusCode`  | `number`   | HTTP response status code eg `404`                     |
| `error.headers`     | `Headers`  | HTTP response headers                                  |
| `error.body`        | `string`   | HTTP body. Can be empty string if no body is returned. |
| `error.rawResponse` | `Response` | Raw HTTP response                                      |

### Example
```typescript
import { VibenClient } from "@viben/client-sdk";
import * as errors from "@viben/client-sdk/sdk/models/errors";

const vibenClient = new VibenClient();

async function run() {
  try {
    const result = await vibenClient.agent.list();

    console.log(result);
  } catch (error) {
    if (error instanceof errors.SDKBaseError) {
      console.log(error.message);
      console.log(error.statusCode);
      console.log(error.body);
      console.log(error.headers);
    }
  }
}

run();

```

### Error Classes
**Primary error:**
* [`SDKBaseError`](./src/sdk/models/errors/sdkbaseerror.ts): The base class for HTTP error responses.

<details><summary>Less common errors (6)</summary>

<br />

**Network errors:**
* [`ConnectionError`](./src/sdk/models/errors/httpclienterrors.ts): HTTP client was unable to make a request to a server.
* [`RequestTimeoutError`](./src/sdk/models/errors/httpclienterrors.ts): HTTP request timed out due to an AbortSignal signal.
* [`RequestAbortedError`](./src/sdk/models/errors/httpclienterrors.ts): HTTP request was aborted by the client.
* [`InvalidRequestError`](./src/sdk/models/errors/httpclienterrors.ts): Any input used to create a request is invalid.
* [`UnexpectedClientError`](./src/sdk/models/errors/httpclienterrors.ts): Unrecognised or unexpected error.


**Inherit from [`SDKBaseError`](./src/sdk/models/errors/sdkbaseerror.ts)**:
* [`ResponseValidationError`](./src/sdk/models/errors/responsevalidationerror.ts): Type mismatch between the data returned from the server and the structure expected by the SDK. See `error.rawValue` for the raw value and `error.pretty()` for a nicely formatted multi-line string.

</details>
<!-- End Error Handling [errors] -->

<!-- Start Server Selection [server] -->
## Server Selection

### Override Server URL Per-Client

The default server can be overridden globally by passing a URL to the `serverURL: string` optional parameter when initializing the SDK client instance. For example:
```typescript
import { VibenClient } from "@viben/client-sdk";

const vibenClient = new VibenClient({
  serverURL: "http://127.0.0.1:18790",
});

async function run() {
  const result = await vibenClient.agent.list();

  console.log(result);
}

run();

```
<!-- End Server Selection [server] -->

<!-- Start Custom HTTP Client [http-client] -->
## Custom HTTP Client

The TypeScript SDK makes API calls using an `HTTPClient` that wraps the native
[Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). This
client is a thin wrapper around `fetch` and provides the ability to attach hooks
around the request lifecycle that can be used to modify the request or handle
errors and response.

The `HTTPClient` constructor takes an optional `fetcher` argument that can be
used to integrate a third-party HTTP client or when writing tests to mock out
the HTTP client and feed in fixtures.

The following example shows how to:
- route requests through a proxy server using [undici](https://www.npmjs.com/package/undici)'s ProxyAgent
- use the `"beforeRequest"` hook to add a custom header and a timeout to requests
- use the `"requestError"` hook to log errors

```typescript
import { VibenClient } from "@viben/client-sdk";
import { ProxyAgent } from "undici";
import { HTTPClient } from "@viben/client-sdk/lib/http";

const dispatcher = new ProxyAgent("http://proxy.example.com:8080");

const httpClient = new HTTPClient({
  // 'fetcher' takes a function that has the same signature as native 'fetch'.
  fetcher: (input, init) =>
    // 'dispatcher' is specific to undici and not part of the standard Fetch API.
    fetch(input, { ...init, dispatcher } as RequestInit),
});

httpClient.addHook("beforeRequest", (request) => {
  const nextRequest = new Request(request, {
    signal: request.signal || AbortSignal.timeout(5000)
  });

  nextRequest.headers.set("x-custom-header", "custom value");

  return nextRequest;
});

httpClient.addHook("requestError", (error, request) => {
  console.group("Request Error");
  console.log("Reason:", `${error}`);
  console.log("Endpoint:", `${request.method} ${request.url}`);
  console.groupEnd();
});

const sdk = new VibenClient({ httpClient: httpClient });
```
<!-- End Custom HTTP Client [http-client] -->

<!-- Start Debugging [debug] -->
## Debugging

You can setup your SDK to emit debug logs for SDK requests and responses.

You can pass a logger that matches `console`'s interface as an SDK option.

> [!WARNING]
> Beware that debug logging will reveal secrets, like API tokens in headers, in log messages printed to a console or files. It's recommended to use this feature only during local development and not in production.

```typescript
import { VibenClient } from "@viben/client-sdk";

const sdk = new VibenClient({ debugLogger: console });
```
<!-- End Debugging [debug] -->

<!-- Placeholder for Future Speakeasy SDK Sections -->

# Development

## Maturity

This SDK is in beta, and there may be breaking changes between versions without a major version update. Therefore, we recommend pinning usage
to a specific package version. This way, you can install the same version each time without breaking changes unless you are intentionally
looking for the latest version.

## Contributions

While we value open-source contributions to this SDK, this library is generated programmatically. Any manual changes added to internal files will be overwritten on the next generation. 
We look forward to hearing your feedback. Feel free to open a PR or an issue with a proof of concept and we'll do our best to include it in a future release. 

### SDK Created by [Speakeasy](https://www.speakeasy.com/?utm_source=@viben/client-sdk&utm_campaign=typescript)
