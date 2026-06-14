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
import { SDK } from "@viben/client-sdk";

const sdk = new SDK();

async function run() {
  await sdk.deleteApiAccountsId({
    id: "<id>",
  });
}

run();

```
<!-- End SDK Example Usage [usage] -->

<!-- Start Available Resources and Operations [operations] -->
## Available Resources and Operations

<details open>
<summary>Available methods</summary>

### [SDK](docs/sdks/sdk/README.md)

* [deleteApiAccountsId](docs/sdks/sdk/README.md#deleteapiaccountsid)
* [deleteApiAgentId](docs/sdks/sdk/README.md#deleteapiagentid)
* [deleteApiAgentIdSessionsSessionId](docs/sdks/sdk/README.md#deleteapiagentidsessionssessionid)
* [deleteApiApiLogsRunId](docs/sdks/sdk/README.md#deleteapiapilogsrunid)
* [deleteApiBrowsePluginsPluginId](docs/sdks/sdk/README.md#deleteapibrowsepluginspluginid)
* [deleteApiCache](docs/sdks/sdk/README.md#deleteapicache)
* [deleteApiChannelsId](docs/sdks/sdk/README.md#deleteapichannelsid)
* [deleteApiCronId](docs/sdks/sdk/README.md#deleteapicronid)
* [deleteApiCronIdLogs](docs/sdks/sdk/README.md#deleteapicronidlogs)
* [deleteApiDevicesId](docs/sdks/sdk/README.md#deleteapidevicesid)
* [deleteApiFiles](docs/sdks/sdk/README.md#deleteapifiles)
* [deleteApiGithubAuth](docs/sdks/sdk/README.md#deleteapigithubauth)
* [deleteApiGithubAutofixTasksTaskId](docs/sdks/sdk/README.md#deleteapigithubautofixtaskstaskid)
* [deleteApiGithubAutofixWorktrees](docs/sdks/sdk/README.md#deleteapigithubautofixworktrees)
* [deleteApiGithubReposConnect](docs/sdks/sdk/README.md#deleteapigithubreposconnect)
* [deleteApiGroupChatsId](docs/sdks/sdk/README.md#deleteapigroupchatsid)
* [deleteApiGroupChatsIdFilesFilename](docs/sdks/sdk/README.md#deleteapigroupchatsidfilesfilename)
* [deleteApiGroupChatsIdMembersMemberId](docs/sdks/sdk/README.md#deleteapigroupchatsidmembersmemberid)
* [deleteApiGroupChatsIdPicturesFilename](docs/sdks/sdk/README.md#deleteapigroupchatsidpicturesfilename)
* [deleteApiGroupChatsIdSessionsSessionId](docs/sdks/sdk/README.md#deleteapigroupchatsidsessionssessionid)
* [deleteApiHistory](docs/sdks/sdk/README.md#deleteapihistory)
* [deleteApiHistoryId](docs/sdks/sdk/README.md#deleteapihistoryid)
* [deleteApiKanbanTasksTaskIdCommentsCommentId](docs/sdks/sdk/README.md#deleteapikanbantaskstaskidcommentscommentid)
* [deleteApiKanbanTasksTaskIdData](docs/sdks/sdk/README.md#deleteapikanbantaskstaskiddata)
* [deleteApiLogs](docs/sdks/sdk/README.md#deleteapilogs)
* [deleteApiLogsSessionSessionId](docs/sdks/sdk/README.md#deleteapilogssessionsessionid)
* [deleteApiMarketplaceCache](docs/sdks/sdk/README.md#deleteapimarketplacecache)
* [deleteApiMcpServerBrowse](docs/sdks/sdk/README.md#deleteapimcpserverbrowse)
* [deleteApiMcpServerGuiAction](docs/sdks/sdk/README.md#deleteapimcpserverguiaction)
* [deleteApiMcpAgentsAgentIdServersName](docs/sdks/sdk/README.md#deleteapimcpagentsagentidserversname)
* [deleteApiMcpInspectorMcp](docs/sdks/sdk/README.md#deleteapimcpinspectormcp)
* [deleteApiMcpInspectorSessionsSessionId](docs/sdks/sdk/README.md#deleteapimcpinspectorsessionssessionid)
* [deleteApiMcpTauriMcp](docs/sdks/sdk/README.md#deleteapimcptaurimcp)
* [deleteApiModelsAliasesAlias](docs/sdks/sdk/README.md#deleteapimodelsaliasesalias)
* [deleteApiModelsFallbacks](docs/sdks/sdk/README.md#deleteapimodelsfallbacks)
* [deleteApiModelsFallbacksModel](docs/sdks/sdk/README.md#deleteapimodelsfallbacksmodel)
* [deleteApiModelsId](docs/sdks/sdk/README.md#deleteapimodelsid)
* [deleteApiModelsIdConfig](docs/sdks/sdk/README.md#deleteapimodelsidconfig)
* [deleteApiOfficialRegistryCache](docs/sdks/sdk/README.md#deleteapiofficialregistrycache)
* [deleteApiOfficialRegistryServersNameCache](docs/sdks/sdk/README.md#deleteapiofficialregistryserversnamecache)
* [deleteApiProvidersId](docs/sdks/sdk/README.md#deleteapiprovidersid)
* [deleteApiQueueTasksId](docs/sdks/sdk/README.md#deleteapiqueuetasksid)
* [deleteApiServiceKeysKeyId](docs/sdks/sdk/README.md#deleteapiservicekeyskeyid)
* [deleteApiSessionsId](docs/sdks/sdk/README.md#deleteapisessionsid)
* [deleteApiTasksId](docs/sdks/sdk/README.md#deleteapitasksid)
* [deleteApiTelemetryClean](docs/sdks/sdk/README.md#deleteapitelemetryclean)
* [deleteApiWorkspacesId](docs/sdks/sdk/README.md#deleteapiworkspacesid)
* [getApiAccounts](docs/sdks/sdk/README.md#getapiaccounts)
* [getApiAccountsId](docs/sdks/sdk/README.md#getapiaccountsid)
* [getApiAgentDefault](docs/sdks/sdk/README.md#getapiagentdefault)
* [getApiAgentPlanPlanId](docs/sdks/sdk/README.md#getapiagentplanplanid)
* [getApiAgentSessionSessionId](docs/sdks/sdk/README.md#getapiagentsessionsessionid)
* [getApiAgentTasksSubscribe](docs/sdks/sdk/README.md#getapiagenttaskssubscribe)
* [getApiAgentTemplates](docs/sdks/sdk/README.md#getapiagenttemplates)
* [getApiAgentTemplatesId](docs/sdks/sdk/README.md#getapiagenttemplatesid)
* [getApiAgentAgentIdSessionsSessionIdTasks](docs/sdks/sdk/README.md#getapiagentagentidsessionssessionidtasks)
* [getApiAgentAgentIdSessionsSessionIdTasksTaskIdMessages](docs/sdks/sdk/README.md#getapiagentagentidsessionssessionidtaskstaskidmessages)
* [getApiAgentAgentIdTasks](docs/sdks/sdk/README.md#getapiagentagentidtasks)
* [getApiAgentId](docs/sdks/sdk/README.md#getapiagentid)
* [getApiAgentIdAvailability](docs/sdks/sdk/README.md#getapiagentidavailability)
* [getApiAgentIdSessions](docs/sdks/sdk/README.md#getapiagentidsessions)
* [getApiAgentIdSessionsSessionId](docs/sdks/sdk/README.md#getapiagentidsessionssessionid)
* [getApiAgentIdSessionsSessionIdMessages](docs/sdks/sdk/README.md#getapiagentidsessionssessionidmessages)
* [getApiAgentIdSessionsSessionIdUiMessages](docs/sdks/sdk/README.md#getapiagentidsessionssessioniduimessages)
* [getApiApiLogsDir](docs/sdks/sdk/README.md#getapiapilogsdir)
* [getApiApiLogsSessions](docs/sdks/sdk/README.md#getapiapilogssessions)
* [getApiApiLogsRunId](docs/sdks/sdk/README.md#getapiapilogsrunid)
* [getApiApiLogsRunIdSummary](docs/sdks/sdk/README.md#getapiapilogsrunidsummary)
* [getApiBrowsePluginsInstalled](docs/sdks/sdk/README.md#getapibrowsepluginsinstalled)
* [getApiBrowsePluginsRegistry](docs/sdks/sdk/README.md#getapibrowsepluginsregistry)
* [getApiBrowsePluginsPluginId](docs/sdks/sdk/README.md#getapibrowsepluginspluginid)
* [getApiCacheInfo](docs/sdks/sdk/README.md#getapicacheinfo)
* [getApiCacheOffline](docs/sdks/sdk/README.md#getapicacheoffline)
* [getApiCacheSettings](docs/sdks/sdk/README.md#getapicachesettings)
* [getApiCacheShouldRefresh](docs/sdks/sdk/README.md#getapicacheshouldrefresh)
* [getApiChatList](docs/sdks/sdk/README.md#getapichatlist)
* [getApiCliToolsConfig](docs/sdks/sdk/README.md#getapiclitoolsconfig)
* [getApiCliToolsDetect](docs/sdks/sdk/README.md#getapiclitoolsdetect)
* [getApiCommandQueueConfig](docs/sdks/sdk/README.md#getapicommandqueueconfig)
* [getApiCommandQueueItems](docs/sdks/sdk/README.md#getapicommandqueueitems)
* [getApiCommandQueueItemsId](docs/sdks/sdk/README.md#getapicommandqueueitemsid)
* [getApiCommandQueueItemsIdLogs](docs/sdks/sdk/README.md#getapicommandqueueitemsidlogs)
* [getApiCommandQueueStatus](docs/sdks/sdk/README.md#getapicommandqueuestatus)
* [getApiCommandsSkills](docs/sdks/sdk/README.md#getapicommandsskills)
* [getApiCommandsWorkspace](docs/sdks/sdk/README.md#getapicommandsworkspace)
* [getApiCronIdLogs](docs/sdks/sdk/README.md#getapicronidlogs)
* [getApiDevices](docs/sdks/sdk/README.md#getapidevices)
* [getApiDevicesQr](docs/sdks/sdk/README.md#getapidevicesqr)
* [getApiDevicesId](docs/sdks/sdk/README.md#getapidevicesid)
* [getApiEvents](docs/sdks/sdk/README.md#getapievents)
* [getApiExchanges](docs/sdks/sdk/README.md#getapiexchanges)
* [getApiExecutorsTypeCommands](docs/sdks/sdk/README.md#getapiexecutorstypecommands)
* [getApiExecutorsTypeCommandsCommandId](docs/sdks/sdk/README.md#getapiexecutorstypecommandscommandid)
* [getApiExecutorsTypeDiscoverSessions](docs/sdks/sdk/README.md#getapiexecutorstypediscoversessions)
* [getApiExecutorsTypeMcpServers](docs/sdks/sdk/README.md#getapiexecutorstypemcpservers)
* [getApiExecutorsTypePrompts](docs/sdks/sdk/README.md#getapiexecutorstypeprompts)
* [getApiExecutorsTypePromptsPromptId](docs/sdks/sdk/README.md#getapiexecutorstypepromptspromptid)
* [getApiExecutorsTypeSessionsSessionIdMessages](docs/sdks/sdk/README.md#getapiexecutorstypesessionssessionidmessages)
* [getApiExecutorsTypeSkills](docs/sdks/sdk/README.md#getapiexecutorstypeskills)
* [getApiExecutorsTypeSubagents](docs/sdks/sdk/README.md#getapiexecutorstypesubagents)
* [getApiExecutorsTypeSubagentsConfigId](docs/sdks/sdk/README.md#getapiexecutorstypesubagentsconfigid)
* [getApiFilesConfigDir](docs/sdks/sdk/README.md#getapifilesconfigdir)
* [getApiFilesContent](docs/sdks/sdk/README.md#getapifilescontent)
* [getApiFilesDirectory](docs/sdks/sdk/README.md#getapifilesdirectory)
* [getApiFilesGitDiff](docs/sdks/sdk/README.md#getapifilesgitdiff)
* [getApiFilesGitStatus](docs/sdks/sdk/README.md#getapifilesgitstatus)
* [getApiFilesList](docs/sdks/sdk/README.md#getapifileslist)
* [getApiFilesMcpServers](docs/sdks/sdk/README.md#getapifilesmcpservers)
* [getApiGithubAuthStatus](docs/sdks/sdk/README.md#getapigithubauthstatus)
* [getApiGithubAutofixConfig](docs/sdks/sdk/README.md#getapigithubautofixconfig)
* [getApiGithubAutofixTasks](docs/sdks/sdk/README.md#getapigithubautofixtasks)
* [getApiGithubAutofixTasksTaskId](docs/sdks/sdk/README.md#getapigithubautofixtaskstaskid)
* [getApiGithubAutofixWorktrees](docs/sdks/sdk/README.md#getapigithubautofixworktrees)
* [getApiGithubIssues](docs/sdks/sdk/README.md#getapigithubissues)
* [getApiGithubIssuesNumber](docs/sdks/sdk/README.md#getapigithubissuesnumber)
* [getApiGithubIssuesNumberComments](docs/sdks/sdk/README.md#getapigithubissuesnumbercomments)
* [getApiGithubPrs](docs/sdks/sdk/README.md#getapigithubprs)
* [getApiGithubPrsNumber](docs/sdks/sdk/README.md#getapigithubprsnumber)
* [getApiGithubReleases](docs/sdks/sdk/README.md#getapigithubreleases)
* [getApiGithubReleasesLatest](docs/sdks/sdk/README.md#getapigithubreleaseslatest)
* [getApiGithubRepos](docs/sdks/sdk/README.md#getapigithubrepos)
* [getApiGithubReposConnected](docs/sdks/sdk/README.md#getapigithubreposconnected)
* [getApiGithubReposDetect](docs/sdks/sdk/README.md#getapigithubreposdetect)
* [getApiGroupChats](docs/sdks/sdk/README.md#getapigroupchats)
* [getApiGroupChatsId](docs/sdks/sdk/README.md#getapigroupchatsid)
* [getApiGroupChatsIdFiles](docs/sdks/sdk/README.md#getapigroupchatsidfiles)
* [getApiGroupChatsIdFilesFilename](docs/sdks/sdk/README.md#getapigroupchatsidfilesfilename)
* [getApiGroupChatsIdMembers](docs/sdks/sdk/README.md#getapigroupchatsidmembers)
* [getApiGroupChatsIdPictures](docs/sdks/sdk/README.md#getapigroupchatsidpictures)
* [getApiGroupChatsIdPicturesFilename](docs/sdks/sdk/README.md#getapigroupchatsidpicturesfilename)
* [getApiGroupChatsIdSessions](docs/sdks/sdk/README.md#getapigroupchatsidsessions)
* [getApiGroupChatsIdSessionsSessionId](docs/sdks/sdk/README.md#getapigroupchatsidsessionssessionid)
* [getApiGroupChatsIdSessionsSessionIdAgents](docs/sdks/sdk/README.md#getapigroupchatsidsessionssessionidagents)
* [getApiGroupChatsIdSessionsSessionIdMessages](docs/sdks/sdk/README.md#getapigroupchatsidsessionssessionidmessages)
* [getApiHistory](docs/sdks/sdk/README.md#getapihistory)
* [getApiHistoryId](docs/sdks/sdk/README.md#getapihistoryid)
* [getApiLogsDir](docs/sdks/sdk/README.md#getapilogsdir)
* [getApiLogsSessionSessionId](docs/sdks/sdk/README.md#getapilogssessionsessionid)
* [getApiLogsSessions](docs/sdks/sdk/README.md#getapilogssessions)
* [getApiMarketplaceCategories](docs/sdks/sdk/README.md#getapimarketplacecategories)
* [getApiMarketplaceCategoriesCategoryIdPlugins](docs/sdks/sdk/README.md#getapimarketplacecategoriescategoryidplugins)
* [getApiMarketplaceIndex](docs/sdks/sdk/README.md#getapimarketplaceindex)
* [getApiMarketplacePlugins](docs/sdks/sdk/README.md#getapimarketplaceplugins)
* [getApiMarketplacePluginsPluginId](docs/sdks/sdk/README.md#getapimarketplacepluginspluginid)
* [getApiMarketplaceSearch](docs/sdks/sdk/README.md#getapimarketplacesearch)
* [getApiMarketplaceSources](docs/sdks/sdk/README.md#getapimarketplacesources)
* [getApiMcpServerBrowse](docs/sdks/sdk/README.md#getapimcpserverbrowse)
* [getApiMcpServerGuiAction](docs/sdks/sdk/README.md#getapimcpserverguiaction)
* [getApiMcpAgentsAgentIdServers](docs/sdks/sdk/README.md#getapimcpagentsagentidservers)
* [getApiMcpAgentsAgentIdServersName](docs/sdks/sdk/README.md#getapimcpagentsagentidserversname)
* [getApiMcpBrowseStatus](docs/sdks/sdk/README.md#getapimcpbrowsestatus)
* [getApiMcpInspectorConfig](docs/sdks/sdk/README.md#getapimcpinspectorconfig)
* [getApiMcpInspectorHealth](docs/sdks/sdk/README.md#getapimcpinspectorhealth)
* [getApiMcpInspectorMcp](docs/sdks/sdk/README.md#getapimcpinspectormcp)
* [getApiMcpInspectorSessions](docs/sdks/sdk/README.md#getapimcpinspectorsessions)
* [getApiMcpInspectorSse](docs/sdks/sdk/README.md#getapimcpinspectorsse)
* [getApiMcpInspectorStdio](docs/sdks/sdk/README.md#getapimcpinspectorstdio)
* [getApiMcpInspectorToken](docs/sdks/sdk/README.md#getapimcpinspectortoken)
* [getApiMcpProxyStatus](docs/sdks/sdk/README.md#getapimcpproxystatus)
* [getApiMcpTauriMcp](docs/sdks/sdk/README.md#getapimcptaurimcp)
* [getApiMcpTauriSse](docs/sdks/sdk/README.md#getapimcptaurisse)
* [getApiMeshPeers](docs/sdks/sdk/README.md#getapimeshpeers)
* [getApiModelsAliases](docs/sdks/sdk/README.md#getapimodelsaliases)
* [getApiModelsDefault](docs/sdks/sdk/README.md#getapimodelsdefault)
* [getApiModelsFallbacks](docs/sdks/sdk/README.md#getapimodelsfallbacks)
* [getApiModelsIdConfig](docs/sdks/sdk/README.md#getapimodelsidconfig)
* [getApiOfficialRegistryServers](docs/sdks/sdk/README.md#getapiofficialregistryservers)
* [getApiOfficialRegistryServersName](docs/sdks/sdk/README.md#getapiofficialregistryserversname)
* [getApiOfficialRegistryServersNameVersions](docs/sdks/sdk/README.md#getapiofficialregistryserversnameversions)
* [getApiPackagesInstalled](docs/sdks/sdk/README.md#getapipackagesinstalled)
* [getApiPackagesMcp](docs/sdks/sdk/README.md#getapipackagesmcp)
* [getApiPackagesSkills](docs/sdks/sdk/README.md#getapipackagesskills)
* [getApiPatches](docs/sdks/sdk/README.md#getapipatches)
* [getApiPetAssetIdFilename](docs/sdks/sdk/README.md#getapipetassetidfilename)
* [getApiPetCommunity](docs/sdks/sdk/README.md#getapipetcommunity)
* [getApiPetConfig](docs/sdks/sdk/README.md#getapipetconfig)
* [getApiPetExportId](docs/sdks/sdk/README.md#getapipetexportid)
* [getApiPetList](docs/sdks/sdk/README.md#getapipetlist)
* [getApiPetPreviewId](docs/sdks/sdk/README.md#getapipetpreviewid)
* [getApiPetSearch](docs/sdks/sdk/README.md#getapipetsearch)
* [getApiPetShowId](docs/sdks/sdk/README.md#getapipetshowid)
* [getApiPetSourcesList](docs/sdks/sdk/README.md#getapipetsourceslist)
* [getApiPreferences](docs/sdks/sdk/README.md#getapipreferences)
* [getApiPreferencesDeveloper](docs/sdks/sdk/README.md#getapipreferencesdeveloper)
* [getApiPreferencesDeveloperIde](docs/sdks/sdk/README.md#getapipreferencesdeveloperide)
* [getApiPreferencesDeveloperTerminal](docs/sdks/sdk/README.md#getapipreferencesdeveloperterminal)
* [getApiPreferencesNotifications](docs/sdks/sdk/README.md#getapipreferencesnotifications)
* [getApiProvidersApiKeys](docs/sdks/sdk/README.md#getapiprovidersapikeys)
* [getApiProvidersApiKeysAll](docs/sdks/sdk/README.md#getapiprovidersapikeysall)
* [getApiProvidersDefault](docs/sdks/sdk/README.md#getapiprovidersdefault)
* [getApiProvidersIdDiscoverModels](docs/sdks/sdk/README.md#getapiprovidersiddiscovermodels)
* [getApiProvidersIdModels](docs/sdks/sdk/README.md#getapiprovidersidmodels)
* [getApiPythonDetect](docs/sdks/sdk/README.md#getapipythondetect)
* [getApiQueueConfig](docs/sdks/sdk/README.md#getapiqueueconfig)
* [getApiQueueStatus](docs/sdks/sdk/README.md#getapiqueuestatus)
* [getApiQueueTasks](docs/sdks/sdk/README.md#getapiqueuetasks)
* [getApiQueueTasksId](docs/sdks/sdk/README.md#getapiqueuetasksid)
* [getApiQueueTasksIdRunning](docs/sdks/sdk/README.md#getapiqueuetasksidrunning)
* [getApiQueueTasksIdStream](docs/sdks/sdk/README.md#getapiqueuetasksidstream)
* [getApiSandboxAvailable](docs/sdks/sdk/README.md#getapisandboxavailable)
* [getApiServiceKeys](docs/sdks/sdk/README.md#getapiservicekeys)
* [getApiServiceKeysKeyId](docs/sdks/sdk/README.md#getapiservicekeyskeyid)
* [getApiSessionsIdMessages](docs/sdks/sdk/README.md#getapisessionsidmessages)
* [getApiSessionsIdUiMessages](docs/sdks/sdk/README.md#getapisessionsiduimessages)
* [getApiSourcesInstalled](docs/sdks/sdk/README.md#getapisourcesinstalled)
* [getApiSourcesProviderProvider](docs/sdks/sdk/README.md#getapisourcesproviderprovider)
* [getApiSystemInfo](docs/sdks/sdk/README.md#getapisysteminfo)
* [getApiSystemPublicIp](docs/sdks/sdk/README.md#getapisystempublicip)
* [getApiTasksEventsStream](docs/sdks/sdk/README.md#getapitaskseventsstream)
* [getApiTasksTaskIdSessions](docs/sdks/sdk/README.md#getapitaskstaskidsessions)
* [getApiTasksTaskIdEvents](docs/sdks/sdk/README.md#getapitaskstaskidevents)
* [getApiTasksTaskIdEventsStream](docs/sdks/sdk/README.md#getapitaskstaskideventsstream)
* [getApiTasksTaskIdState](docs/sdks/sdk/README.md#getapitaskstaskidstate)
* [getApiTelemetryDates](docs/sdks/sdk/README.md#getapitelemetrydates)
* [getApiTelemetryStats](docs/sdks/sdk/README.md#getapitelemetrystats)
* [getApiTelemetryTraceId](docs/sdks/sdk/README.md#getapitelemetrytraceid)
* [getApiTelemetryTraceIdSpans](docs/sdks/sdk/README.md#getapitelemetrytraceidspans)
* [getApiTelemetryTraces](docs/sdks/sdk/README.md#getapitelemetrytraces)
* [getApiTunnelStatus](docs/sdks/sdk/README.md#getapitunnelstatus)
* [getApiUsageApiKeyKeyId](docs/sdks/sdk/README.md#getapiusageapikeykeyid)
* [getApiUsageServerServerId](docs/sdks/sdk/README.md#getapiusageserverserverid)
* [getApiUsageSourceSourceId](docs/sdks/sdk/README.md#getapiusagesourcesourceid)
* [getApiUsageStats](docs/sdks/sdk/README.md#getapiusagestats)
* [getOpenapiJson](docs/sdks/sdk/README.md#getopenapijson)
* [getOpenapiYaml](docs/sdks/sdk/README.md#getopenapiyaml)
* [patchApiAgentId](docs/sdks/sdk/README.md#patchapiagentid)
* [patchApiChannelsId](docs/sdks/sdk/README.md#patchapichannelsid)
* [patchApiCliToolsConfig](docs/sdks/sdk/README.md#patchapiclitoolsconfig)
* [patchApiCronId](docs/sdks/sdk/README.md#patchapicronid)
* [patchApiGroupChatsId](docs/sdks/sdk/README.md#patchapigroupchatsid)
* [patchApiGroupChatsIdSessionsSessionId](docs/sdks/sdk/README.md#patchapigroupchatsidsessionssessionid)
* [patchApiKanbanTasksTaskIdCommentsCommentId](docs/sdks/sdk/README.md#patchapikanbantaskstaskidcommentscommentid)
* [patchApiMcpAgentsAgentIdServersName](docs/sdks/sdk/README.md#patchapimcpagentsagentidserversname)
* [patchApiModelsId](docs/sdks/sdk/README.md#patchapimodelsid)
* [patchApiPreferencesDeveloper](docs/sdks/sdk/README.md#patchapipreferencesdeveloper)
* [patchApiPreferencesNotifications](docs/sdks/sdk/README.md#patchapipreferencesnotifications)
* [patchApiProvidersId](docs/sdks/sdk/README.md#patchapiprovidersid)
* [patchApiServiceKeysKeyId](docs/sdks/sdk/README.md#patchapiservicekeyskeyid)
* [patchApiSessionsId](docs/sdks/sdk/README.md#patchapisessionsid)
* [patchApiTasksId](docs/sdks/sdk/README.md#patchapitasksid)
* [postApiAccounts](docs/sdks/sdk/README.md#postapiaccounts)
* [postApiAccountsIdTest](docs/sdks/sdk/README.md#postapiaccountsidtest)
* [postApiAgent](docs/sdks/sdk/README.md#postapiagent)
* [postApiAgentAnswerQuestionId](docs/sdks/sdk/README.md#postapiagentanswerquestionid)
* [postApiAgentApprovePlanId](docs/sdks/sdk/README.md#postapiagentapproveplanid)
* [postApiAgentRejectPlanId](docs/sdks/sdk/README.md#postapiagentrejectplanid)
* [postApiAgentRun](docs/sdks/sdk/README.md#postapiagentrun)
* [postApiAgentSessionSessionIdSteer](docs/sdks/sdk/README.md#postapiagentsessionsessionidsteer)
* [postApiAgentStopSessionId](docs/sdks/sdk/README.md#postapiagentstopsessionid)
* [postApiAgentTasksTaskIdStop](docs/sdks/sdk/README.md#postapiagenttaskstaskidstop)
* [postApiAgentTemplates](docs/sdks/sdk/README.md#postapiagenttemplates)
* [postApiAgentTemplatesIdInstantiate](docs/sdks/sdk/README.md#postapiagenttemplatesidinstantiate)
* [postApiAgentIdPromote](docs/sdks/sdk/README.md#postapiagentidpromote)
* [postApiAgentIdSessions](docs/sdks/sdk/README.md#postapiagentidsessions)
* [postApiAgentIdSessionsSessionIdMessages](docs/sdks/sdk/README.md#postapiagentidsessionssessionidmessages)
* [postApiApiLogsOpen](docs/sdks/sdk/README.md#postapiapilogsopen)
* [postApiBrowsePluginsInstall](docs/sdks/sdk/README.md#postapibrowsepluginsinstall)
* [postApiCacheRefresh](docs/sdks/sdk/README.md#postapicacherefresh)
* [postApiChannels](docs/sdks/sdk/README.md#postapichannels)
* [postApiChannelsSend](docs/sdks/sdk/README.md#postapichannelssend)
* [postApiChannelsSendTest](docs/sdks/sdk/README.md#postapichannelssendtest)
* [postApiChannelsTest](docs/sdks/sdk/README.md#postapichannelstest)
* [postApiChannelsWebhook](docs/sdks/sdk/README.md#postapichannelswebhook)
* [postApiChannelsIdDefault](docs/sdks/sdk/README.md#postapichannelsiddefault)
* [postApiChannelsIdWebhook](docs/sdks/sdk/README.md#postapichannelsidwebhook)
* [postApiCliToolsCheck](docs/sdks/sdk/README.md#postapiclitoolscheck)
* [postApiCliToolsConfig](docs/sdks/sdk/README.md#postapiclitoolsconfig)
* [postApiClientToolsComplete](docs/sdks/sdk/README.md#postapiclienttoolscomplete)
* [postApiClientToolsRequest](docs/sdks/sdk/README.md#postapiclienttoolsrequest)
* [postApiCommandQueueClean](docs/sdks/sdk/README.md#postapicommandqueueclean)
* [postApiCommandQueueEnqueue](docs/sdks/sdk/README.md#postapicommandqueueenqueue)
* [postApiCommandQueueItemsIdCancel](docs/sdks/sdk/README.md#postapicommandqueueitemsidcancel)
* [postApiCommandQueueItemsIdRetry](docs/sdks/sdk/README.md#postapicommandqueueitemsidretry)
* [postApiCron](docs/sdks/sdk/README.md#postapicron)
* [postApiCronIdDisable](docs/sdks/sdk/README.md#postapicroniddisable)
* [postApiCronIdEnable](docs/sdks/sdk/README.md#postapicronidenable)
* [postApiCronIdRun](docs/sdks/sdk/README.md#postapicronidrun)
* [postApiDevicesMessage](docs/sdks/sdk/README.md#postapidevicesmessage)
* [postApiFiles](docs/sdks/sdk/README.md#postapifiles)
* [postApiFilesCopy](docs/sdks/sdk/README.md#postapifilescopy)
* [postApiFilesDirectory](docs/sdks/sdk/README.md#postapifilesdirectory)
* [postApiFilesMove](docs/sdks/sdk/README.md#postapifilesmove)
* [postApiFilesOpen](docs/sdks/sdk/README.md#postapifilesopen)
* [postApiFilesOpenFolder](docs/sdks/sdk/README.md#postapifilesopenfolder)
* [postApiFilesReveal](docs/sdks/sdk/README.md#postapifilesreveal)
* [postApiGithubAuthGhCli](docs/sdks/sdk/README.md#postapigithubauthghcli)
* [postApiGithubAuthPat](docs/sdks/sdk/README.md#postapigithubauthpat)
* [postApiGithubAutofixTasks](docs/sdks/sdk/README.md#postapigithubautofixtasks)
* [postApiGithubAutofixTasksTaskIdApprove](docs/sdks/sdk/README.md#postapigithubautofixtaskstaskidapprove)
* [postApiGithubAutofixTasksTaskIdCancel](docs/sdks/sdk/README.md#postapigithubautofixtaskstaskidcancel)
* [postApiGithubIssuesCluster](docs/sdks/sdk/README.md#postapigithubissuescluster)
* [postApiGithubIssuesImport](docs/sdks/sdk/README.md#postapigithubissuesimport)
* [postApiGithubIssuesTriage](docs/sdks/sdk/README.md#postapigithubissuestriage)
* [postApiGithubIssuesNumberAnalyze](docs/sdks/sdk/README.md#postapigithubissuesnumberanalyze)
* [postApiGithubIssuesNumberInvestigate](docs/sdks/sdk/README.md#postapigithubissuesnumberinvestigate)
* [postApiGithubPrs](docs/sdks/sdk/README.md#postapigithubprs)
* [postApiGithubReleases](docs/sdks/sdk/README.md#postapigithubreleases)
* [postApiGithubReleasesGenerateNotes](docs/sdks/sdk/README.md#postapigithubreleasesgeneratenotes)
* [postApiGithubReposConnect](docs/sdks/sdk/README.md#postapigithubreposconnect)
* [postApiGroupChats](docs/sdks/sdk/README.md#postapigroupchats)
* [postApiGroupChatsIdFiles](docs/sdks/sdk/README.md#postapigroupchatsidfiles)
* [postApiGroupChatsIdMembers](docs/sdks/sdk/README.md#postapigroupchatsidmembers)
* [postApiGroupChatsIdPictures](docs/sdks/sdk/README.md#postapigroupchatsidpictures)
* [postApiGroupChatsIdSessions](docs/sdks/sdk/README.md#postapigroupchatsidsessions)
* [postApiGroupChatsIdSessionsSessionIdMessages](docs/sdks/sdk/README.md#postapigroupchatsidsessionssessionidmessages)
* [postApiHistory](docs/sdks/sdk/README.md#postapihistory)
* [postApiKanbanTasksTaskIdActivities](docs/sdks/sdk/README.md#postapikanbantaskstaskidactivities)
* [postApiKanbanTasksTaskIdComments](docs/sdks/sdk/README.md#postapikanbantaskstaskidcomments)
* [postApiKanbanTasksTaskIdCommentsCommentIdReactions](docs/sdks/sdk/README.md#postapikanbantaskstaskidcommentscommentidreactions)
* [postApiLogsAdd](docs/sdks/sdk/README.md#postapilogsadd)
* [postApiLogsCleanup](docs/sdks/sdk/README.md#postapilogscleanup)
* [postApiLogsInit](docs/sdks/sdk/README.md#postapilogsinit)
* [postApiLogsSessionSessionIdExport](docs/sdks/sdk/README.md#postapilogssessionsessionidexport)
* [postApiMcpServerBrowse](docs/sdks/sdk/README.md#postapimcpserverbrowse)
* [postApiMcpServerGuiAction](docs/sdks/sdk/README.md#postapimcpserverguiaction)
* [postApiMcpAgentsAgentIdServers](docs/sdks/sdk/README.md#postapimcpagentsagentidservers)
* [postApiMcpAgentsAgentIdServersNameDisable](docs/sdks/sdk/README.md#postapimcpagentsagentidserversnamedisable)
* [postApiMcpAgentsAgentIdServersNameEnable](docs/sdks/sdk/README.md#postapimcpagentsagentidserversnameenable)
* [postApiMcpBrowseStart](docs/sdks/sdk/README.md#postapimcpbrowsestart)
* [postApiMcpBrowseStop](docs/sdks/sdk/README.md#postapimcpbrowsestop)
* [postApiMcpBrowseTest](docs/sdks/sdk/README.md#postapimcpbrowsetest)
* [postApiMcpInspectorMcp](docs/sdks/sdk/README.md#postapimcpinspectormcp)
* [postApiMcpInspectorMessage](docs/sdks/sdk/README.md#postapimcpinspectormessage)
* [postApiMcpInspectorSse](docs/sdks/sdk/README.md#postapimcpinspectorsse)
* [postApiMcpPortStatus](docs/sdks/sdk/README.md#postapimcpportstatus)
* [postApiMcpProcessAlive](docs/sdks/sdk/README.md#postapimcpprocessalive)
* [postApiMcpProcessKill](docs/sdks/sdk/README.md#postapimcpprocesskill)
* [postApiMcpProxyCheckInstalled](docs/sdks/sdk/README.md#postapimcpproxycheckinstalled)
* [postApiMcpProxyInstall](docs/sdks/sdk/README.md#postapimcpproxyinstall)
* [postApiMcpProxyKillPortProcess](docs/sdks/sdk/README.md#postapimcpproxykillportprocess)
* [postApiMcpProxyPortProcess](docs/sdks/sdk/README.md#postapimcpproxyportprocess)
* [postApiMcpProxyStart](docs/sdks/sdk/README.md#postapimcpproxystart)
* [postApiMcpProxyStop](docs/sdks/sdk/README.md#postapimcpproxystop)
* [postApiMcpServerCheckPort](docs/sdks/sdk/README.md#postapimcpservercheckport)
* [postApiMcpTauriMcp](docs/sdks/sdk/README.md#postapimcptaurimcp)
* [postApiMcpTauriMessage](docs/sdks/sdk/README.md#postapimcptaurimessage)
* [postApiMcpTauriSse](docs/sdks/sdk/README.md#postapimcptaurisse)
* [postApiMeshConnect](docs/sdks/sdk/README.md#postapimeshconnect)
* [postApiModels](docs/sdks/sdk/README.md#postapimodels)
* [postApiModelsAliases](docs/sdks/sdk/README.md#postapimodelsaliases)
* [postApiModelsFallbacks](docs/sdks/sdk/README.md#postapimodelsfallbacks)
* [postApiModelsReload](docs/sdks/sdk/README.md#postapimodelsreload)
* [postApiModelsIdDisable](docs/sdks/sdk/README.md#postapimodelsiddisable)
* [postApiModelsIdEnable](docs/sdks/sdk/README.md#postapimodelsidenable)
* [postApiPackagesUpdate](docs/sdks/sdk/README.md#postapipackagesupdate)
* [postApiPageAssetUpload](docs/sdks/sdk/README.md#postapipageassetupload)
* [postApiPetImport](docs/sdks/sdk/README.md#postapipetimport)
* [postApiPetInstall](docs/sdks/sdk/README.md#postapipetinstall)
* [postApiPetRemoveId](docs/sdks/sdk/README.md#postapipetremoveid)
* [postApiPetSetId](docs/sdks/sdk/README.md#postapipetsetid)
* [postApiPetSourcesAdd](docs/sdks/sdk/README.md#postapipetsourcesadd)
* [postApiPetSourcesRemoveName](docs/sdks/sdk/README.md#postapipetsourcesremovename)
* [postApiProviders](docs/sdks/sdk/README.md#postapiproviders)
* [postApiProvidersReload](docs/sdks/sdk/README.md#postapiprovidersreload)
* [postApiProvidersValidateKey](docs/sdks/sdk/README.md#postapiprovidersvalidatekey)
* [postApiProvidersIdDisable](docs/sdks/sdk/README.md#postapiprovidersiddisable)
* [postApiProvidersIdEnable](docs/sdks/sdk/README.md#postapiprovidersidenable)
* [postApiProvidersIdTest](docs/sdks/sdk/README.md#postapiprovidersidtest)
* [postApiProvidersProviderIdModelsModelIdDisable](docs/sdks/sdk/README.md#postapiprovidersprovideridmodelsmodeliddisable)
* [postApiProvidersProviderIdModelsModelIdEnable](docs/sdks/sdk/README.md#postapiprovidersprovideridmodelsmodelidenable)
* [postApiPythonCheck](docs/sdks/sdk/README.md#postapipythoncheck)
* [postApiPythonPackageCheck](docs/sdks/sdk/README.md#postapipythonpackagecheck)
* [postApiPythonPackageInstallCommand](docs/sdks/sdk/README.md#postapipythonpackageinstallcommand)
* [postApiQueueClearHistory](docs/sdks/sdk/README.md#postapiqueueclearhistory)
* [postApiQueueEnqueue](docs/sdks/sdk/README.md#postapiqueueenqueue)
* [postApiQueueEnqueueBatch](docs/sdks/sdk/README.md#postapiqueueenqueuebatch)
* [postApiQueueTasksIdRetry](docs/sdks/sdk/README.md#postapiqueuetasksidretry)
* [postApiSandboxExec](docs/sdks/sdk/README.md#postapisandboxexec)
* [postApiSandboxRunFile](docs/sdks/sdk/README.md#postapisandboxrunfile)
* [postApiSandboxStop](docs/sdks/sdk/README.md#postapisandboxstop)
* [postApiServiceKeys](docs/sdks/sdk/README.md#postapiservicekeys)
* [postApiServiceKeysValidate](docs/sdks/sdk/README.md#postapiservicekeysvalidate)
* [postApiServiceKeysKeyIdUsage](docs/sdks/sdk/README.md#postapiservicekeyskeyidusage)
* [postApiSessions](docs/sdks/sdk/README.md#postapisessions)
* [postApiSourcesProviderInstall](docs/sdks/sdk/README.md#postapisourcesproviderinstall)
* [postApiTasks](docs/sdks/sdk/README.md#postapitasks)
* [postApiTasksTaskIdEvents](docs/sdks/sdk/README.md#postapitaskstaskidevents)
* [postApiTasksTaskIdEventsValidate](docs/sdks/sdk/README.md#postapitaskstaskideventsvalidate)
* [postApiTunnelRestart](docs/sdks/sdk/README.md#postapitunnelrestart)
* [postApiTunnelStart](docs/sdks/sdk/README.md#postapitunnelstart)
* [postApiTunnelStop](docs/sdks/sdk/README.md#postapitunnelstop)
* [postApiUsageInit](docs/sdks/sdk/README.md#postapiusageinit)
* [postApiUsageRecord](docs/sdks/sdk/README.md#postapiusagerecord)
* [postApiWorkspacesCreate](docs/sdks/sdk/README.md#postapiworkspacescreate)
* [putApiAccountsId](docs/sdks/sdk/README.md#putapiaccountsid)
* [putApiAgentDefault](docs/sdks/sdk/README.md#putapiagentdefault)
* [putApiCacheSettings](docs/sdks/sdk/README.md#putapicachesettings)
* [putApiCommandQueueConfig](docs/sdks/sdk/README.md#putapicommandqueueconfig)
* [putApiFilesContent](docs/sdks/sdk/README.md#putapifilescontent)
* [putApiFilesMcpServers](docs/sdks/sdk/README.md#putapifilesmcpservers)
* [putApiFilesRename](docs/sdks/sdk/README.md#putapifilesrename)
* [putApiGithubAutofixConfig](docs/sdks/sdk/README.md#putapigithubautofixconfig)
* [putApiModelsDefault](docs/sdks/sdk/README.md#putapimodelsdefault)
* [putApiModelsFallbacks](docs/sdks/sdk/README.md#putapimodelsfallbacks)
* [putApiModelsIdConfig](docs/sdks/sdk/README.md#putapimodelsidconfig)
* [putApiPetConfig](docs/sdks/sdk/README.md#putapipetconfig)
* [putApiPreferences](docs/sdks/sdk/README.md#putapipreferences)
* [putApiPreferencesDeveloperIde](docs/sdks/sdk/README.md#putapipreferencesdeveloperide)
* [putApiPreferencesDeveloperTerminal](docs/sdks/sdk/README.md#putapipreferencesdeveloperterminal)
* [putApiProvidersDefault](docs/sdks/sdk/README.md#putapiprovidersdefault)
* [putApiQueueConfig](docs/sdks/sdk/README.md#putapiqueueconfig)
* [putApiTasksId](docs/sdks/sdk/README.md#putapitasksid)

### [Agents](docs/sdks/agents/README.md)

* [getApiAgent](docs/sdks/agents/README.md#getapiagent) - List all agents

### [Channels](docs/sdks/channels/README.md)

* [getApiChannels](docs/sdks/channels/README.md#getapichannels) - List all notification channels
* [getApiChannelsId](docs/sdks/channels/README.md#getapichannelsid) - Get a specific channel by ID

### [Cron](docs/sdks/cron/README.md)

* [getApiCron](docs/sdks/cron/README.md#getapicron) - List all cron jobs
* [getApiCronId](docs/sdks/cron/README.md#getapicronid) - Get a specific cron job by ID

### [Executors](docs/sdks/executors/README.md)

* [getApiExecutors](docs/sdks/executors/README.md#getapiexecutors) - List available executors
* [getApiExecutorsOpenclawRuntimeConfig](docs/sdks/executors/README.md#getapiexecutorsopenclawruntimeconfig) - Get the effective OpenClaw gateway config from the server side
* [postApiExecutorsOpenclawTestConnection](docs/sdks/executors/README.md#postapiexecutorsopenclawtestconnection) - Test connection to an OpenClaw gateway with device auth handshake

### [Health](docs/sdks/health/README.md)

* [getHealth](docs/sdks/health/README.md#gethealth) - Health check endpoint

### [Ideas](docs/sdks/ideas/README.md)

* [deleteApiIdeaTypesName](docs/sdks/ideas/README.md#deleteapiideatypesname) - Delete a custom idea type
* [deleteApiIdeas](docs/sdks/ideas/README.md#deleteapiideas) - Remove ideas by type or all ideas
* [deleteApiIdeasId](docs/sdks/ideas/README.md#deleteapiideasid) - Remove a single idea by ID
* [getApiIdeaTypes](docs/sdks/ideas/README.md#getapiideatypes) - List available idea types (builtin + custom)
* [getApiIdeas](docs/sdks/ideas/README.md#getapiideas) - List all ideas for a workspace with optional filtering
* [getApiIdeasId](docs/sdks/ideas/README.md#getapiideasid) - Get a specific idea by ID
* [postApiIdeaTypes](docs/sdks/ideas/README.md#postapiideatypes) - Create a new custom idea type
* [postApiIdeasGenerate](docs/sdks/ideas/README.md#postapiideasgenerate) - Generate ideas by analyzing the codebase using AI
* [postApiIdeasIdDismiss](docs/sdks/ideas/README.md#postapiideasiddismiss) - Dismiss an idea (mark as not worth pursuing)
* [postApiIdeasIdPromote](docs/sdks/ideas/README.md#postapiideasidpromote) - Promote an idea to a task
* [putApiIdeaTypesName](docs/sdks/ideas/README.md#putapiideatypesname) - Update an existing idea type

### [Kanban](docs/sdks/kanban/README.md)

* [getApiKanbanTasksTaskIdActivities](docs/sdks/kanban/README.md#getapikanbantaskstaskidactivities) - Get all activities for a task
* [getApiKanbanTasksTaskIdComments](docs/sdks/kanban/README.md#getapikanbantaskstaskidcomments) - Get all comments for a task

### [Mcp](docs/sdks/mcp/README.md)

* [getApiMcpInfoIdOrSlug](docs/sdks/mcp/README.md#getapimcpinfoidorslug) - Get MCP package details from marketplace
* [getApiMcpInstalled](docs/sdks/mcp/README.md#getapimcpinstalled) - List globally installed MCP servers
* [getApiMcpList](docs/sdks/mcp/README.md#getapimcplist) - List installed MCP packages
* [getApiMcpSearch](docs/sdks/mcp/README.md#getapimcpsearch) - Search MCP packages in marketplace
* [getApiMcpShowName](docs/sdks/mcp/README.md#getapimcpshowname) - Get MCP package details
* [getApiMcpTauriStatus](docs/sdks/mcp/README.md#getapimcptauristatus) - Check tauri-plugin-mcp connection status
* [postApiMcpDownload](docs/sdks/mcp/README.md#postapimcpdownload) - Download MCP package to a directory
* [postApiMcpInstall](docs/sdks/mcp/README.md#postapimcpinstall) - Install an MCP package (supports name, name@version, gh:user/repo, ./path)
* [postApiMcpUninstall](docs/sdks/mcp/README.md#postapimcpuninstall) - Uninstall an MCP package

### [Models](docs/sdks/models/README.md)

* [getApiModels](docs/sdks/models/README.md#getapimodels) - List all models
* [getApiModelsId](docs/sdks/models/README.md#getapimodelsid) - Get a specific model by ID

### [Page](docs/sdks/page/README.md)

* [getApiPageSDKV1VibenPageSDKJs](docs/sdks/page/README.md#getapipagesdkv1vibenpagesdkjs) - Serve viben-page-sdk.js
* [getApiPageSDKV1VibenPageTokensCss](docs/sdks/page/README.md#getapipagesdkv1vibenpagetokenscss) - Serve viben-page-tokens.css
* [getApiPageServe](docs/sdks/page/README.md#getapipageserve) - Serve page content
* [postApiPageCreate](docs/sdks/page/README.md#postapipagecreate) - Create a new page
* [postApiPageDelete](docs/sdks/page/README.md#postapipagedelete) - Delete a page
* [postApiPageDuplicate](docs/sdks/page/README.md#postapipageduplicate) - Duplicate a page (copy all files with a new uid)
* [postApiPageList](docs/sdks/page/README.md#postapipagelist) - List pages in workspace
* [postApiPageReorder](docs/sdks/page/README.md#postapipagereorder) - Reorder pages within a parent level
* [postApiPageServe](docs/sdks/page/README.md#postapipageserve) - Serve page content
* [postApiPageTemplates](docs/sdks/page/README.md#postapipagetemplates) - List available page templates
* [postApiPageUpdateConfig](docs/sdks/page/README.md#postapipageupdateconfig) - Update page config (name, description, icon, cover, page_width, show_toc)
* [postApiPageUpdateContent](docs/sdks/page/README.md#postapipageupdatecontent) - Update page markdown content (preserves YAML frontmatter)
* [postApiPageView](docs/sdks/page/README.md#postapipageview) - Get page by uid

### [Preview](docs/sdks/preview/README.md)

* [getApiPreviewList](docs/sdks/preview/README.md#getapipreviewlist) - List all active preview servers
* [getApiPreviewNodeAvailable](docs/sdks/preview/README.md#getapipreviewnodeavailable) - Check if Node.js is available for Live Preview
* [getApiPreviewStartSse](docs/sdks/preview/README.md#getapipreviewstartsse) - Start a Vite preview server with SSE streaming for real-time feedback
* [getApiPreviewStatusTaskId](docs/sdks/preview/README.md#getapipreviewstatustaskid) - Get status of a preview server
* [postApiPreviewKillPort](docs/sdks/preview/README.md#postapipreviewkillport) - Kill the process occupying a specific port
* [postApiPreviewStart](docs/sdks/preview/README.md#postapipreviewstart) - Start a Vite preview server for a task
* [postApiPreviewStop](docs/sdks/preview/README.md#postapipreviewstop) - Stop a Vite preview server
* [postApiPreviewStopAll](docs/sdks/preview/README.md#postapipreviewstopall) - Stop all running preview servers

### [Providers](docs/sdks/providers/README.md)

* [getApiProviders](docs/sdks/providers/README.md#getapiproviders) - List all providers
* [getApiProvidersId](docs/sdks/providers/README.md#getapiprovidersid) - Get a specific provider by ID

### [Reward](docs/sdks/reward/README.md)

* [deleteApiRewardTypesName](docs/sdks/reward/README.md#deleteapirewardtypesname) - Delete a custom reward type
* [getApiRewardTypes](docs/sdks/reward/README.md#getapirewardtypes) - List available reward types (builtin + custom)
* [getApiRewardTypesName](docs/sdks/reward/README.md#getapirewardtypesname) - Get a specific reward type by name
* [postApiRewardCompute](docs/sdks/reward/README.md#postapirewardcompute) - Compute reward for a task by spawning the reward agent
* [postApiRewardSelect](docs/sdks/reward/README.md#postapirewardselect) - Select best task using PPO metrics
* [postApiRewardTypes](docs/sdks/reward/README.md#postapirewardtypes) - Create a new custom reward type
* [putApiRewardTypesName](docs/sdks/reward/README.md#putapirewardtypesname) - Update a custom reward type

### [Sessions](docs/sdks/sessions/README.md)

* [getApiSessions](docs/sdks/sessions/README.md#getapisessions) - List all sessions
* [getApiSessionsId](docs/sdks/sessions/README.md#getapisessionsid) - Get a specific session by ID

### [Skill](docs/sdks/skill/README.md)

* [getApiSkillAvailable](docs/sdks/skill/README.md#getapiskillavailable) - List available skills from marketplace
* [getApiSkillEnabled](docs/sdks/skill/README.md#getapiskillenabled) - Get enabled skills for an agent
* [getApiSkillInfoIdOrSlug](docs/sdks/skill/README.md#getapiskillinfoidorslug) - Get skill package details from marketplace
* [getApiSkillList](docs/sdks/skill/README.md#getapiskilllist) - List installed skills
* [getApiSkillSearch](docs/sdks/skill/README.md#getapiskillsearch) - Search skill packages in marketplace
* [getApiSkillViewName](docs/sdks/skill/README.md#getapiskillviewname) - Get skill by name
* [postApiSkillDisable](docs/sdks/skill/README.md#postapiskilldisable) - Disable a skill for an agent
* [postApiSkillDownload](docs/sdks/skill/README.md#postapiskilldownload) - Download skill package to a directory
* [postApiSkillEnable](docs/sdks/skill/README.md#postapiskillenable) - Enable a skill for an agent
* [postApiSkillInstall](docs/sdks/skill/README.md#postapiskillinstall) - Install a skill
* [postApiSkillUninstall](docs/sdks/skill/README.md#postapiskilluninstall) - Uninstall a skill

### [Tasks](docs/sdks/tasks/README.md)

* [getApiTaskEventsStream](docs/sdks/tasks/README.md#getapitaskeventsstream) - SSE stream for task events
* [getApiTaskExecutionStream](docs/sdks/tasks/README.md#getapitaskexecutionstream) - SSE stream for task execution progress
* [getApiTaskListArchive](docs/sdks/tasks/README.md#getapitasklistarchive) - List archived tasks
* [getApiTasks](docs/sdks/tasks/README.md#getapitasks) - List all tasks for a workspace (workspace_path required)
* [getApiTasksId](docs/sdks/tasks/README.md#getapitasksid) - Get a specific task by ID
* [getApiTasksIdRunning](docs/sdks/tasks/README.md#getapitasksidrunning) - Check if a task's execution process is currently running
* [getApiTasksIdSpecs](docs/sdks/tasks/README.md#getapitasksidspecs) - Get task specs data (PRD, subtasks, logs, files)
* [postApiTaskAddContext](docs/sdks/tasks/README.md#postapitaskaddcontext) - Add context files to a task
* [postApiTaskAddSession](docs/sdks/tasks/README.md#postapitaskaddsession) - Add a new session to journal file and update index.md
* [postApiTaskApprove](docs/sdks/tasks/README.md#postapitaskapprove) - Approve a task in review: review -> completed
* [postApiTaskArchive](docs/sdks/tasks/README.md#postapitaskarchive) - Archive a completed task: completed -> archived
* [postApiTaskBatchEnqueue](docs/sdks/tasks/README.md#postapitaskbatchenqueue) - Batch enqueue multiple tasks for execution
* [postApiTaskCancel](docs/sdks/tasks/README.md#postapitaskcancel) - Cancel a task: * -> cancelled (terminal state)
* [postApiTaskCheckPhase](docs/sdks/tasks/README.md#postapitaskcheckphase) - Run check phase for a task (spawns check agent)
* [postApiTaskCleanup](docs/sdks/tasks/README.md#postapitaskcleanup) - Cleanup worktrees and related resources
* [postApiTaskClearHistory](docs/sdks/tasks/README.md#postapitaskclearhistory) - Clear completed and failed tasks from queue history
* [postApiTaskContext](docs/sdks/tasks/README.md#postapitaskcontext) - Get session context for AI agents
* [postApiTaskCreate](docs/sdks/tasks/README.md#postapitaskcreate) - Create a new task
* [postApiTaskCreatePr](docs/sdks/tasks/README.md#postapitaskcreatepr) - Create PR from task
* [postApiTaskCreateWorktree](docs/sdks/tasks/README.md#postapitaskcreateworktree) - Create isolated git worktree for a task
* [postApiTaskDelete](docs/sdks/tasks/README.md#postapitaskdelete) - Delete a task
* [postApiTaskDequeue](docs/sdks/tasks/README.md#postapitaskdequeue) - Remove task from queue back to backlog
* [postApiTaskEnqueue](docs/sdks/tasks/README.md#postapitaskenqueue) - Move task from backlog to queue for execution
* [postApiTaskEvents](docs/sdks/tasks/README.md#postapitaskevents) - Get event history for a task
* [postApiTaskExecute](docs/sdks/tasks/README.md#postapitaskexecute) - Trigger task execution via queue system
* [postApiTaskFinish](docs/sdks/tasks/README.md#postapitaskfinish) - Finish a task: clear current task marker
* [postApiTaskImplementPhase](docs/sdks/tasks/README.md#postapitaskimplementphase) - Run implement phase for a task (spawns implement agent)
* [postApiTaskInitContext](docs/sdks/tasks/README.md#postapitaskinitcontext) - Initialize empty context files (implement.jsonl, check.jsonl, fix.jsonl) for a task. Use add-context to add specific files.
* [postApiTaskList](docs/sdks/tasks/README.md#postapitasklist) - List tasks
* [postApiTaskListContext](docs/sdks/tasks/README.md#postapitasklistcontext) - List all context entries for a task
* [postApiTaskPause](docs/sdks/tasks/README.md#postapitaskpause) - Pause a task: in_progress/queue -> paused (saves pausedSnapshot)
* [postApiTaskPlan](docs/sdks/tasks/README.md#postapitaskplan) - Start Plan Agent to plan a task
* [postApiTaskPlanPhase](docs/sdks/tasks/README.md#postapitaskplanphase) - Run plan phase for a task (spawns plan agent)
* [postApiTaskQueueConfig](docs/sdks/tasks/README.md#postapitaskqueueconfig) - Get or update queue configuration
* [postApiTaskQueueStatus](docs/sdks/tasks/README.md#postapitaskqueuestatus) - Get queue status
* [postApiTaskReject](docs/sdks/tasks/README.md#postapitaskreject) - Reject a task in review: review -> backlog
* [postApiTaskRemoveContext](docs/sdks/tasks/README.md#postapitaskremovecontext) - Remove context files from a task
* [postApiTaskResume](docs/sdks/tasks/README.md#postapitaskresume) - Resume a paused task: paused -> queue/in_progress
* [postApiTaskRetry](docs/sdks/tasks/README.md#postapitaskretry) - Retry a failed task: failed -> queue
* [postApiTaskReview](docs/sdks/tasks/README.md#postapitaskreview) - View task details for review
* [postApiTaskRunning](docs/sdks/tasks/README.md#postapitaskrunning) - Check if task execution is running
* [postApiTaskSetAgent](docs/sdks/tasks/README.md#postapitasksetagent) - Set associated agent configuration for a task
* [postApiTaskSetBase](docs/sdks/tasks/README.md#postapitasksetbase) - Set PR target branch for a task
* [postApiTaskSetBranch](docs/sdks/tasks/README.md#postapitasksetbranch) - Set Git branch for a task
* [postApiTaskSpecs](docs/sdks/tasks/README.md#postapitaskspecs) - Get task specs (PRD, subtasks, logs)
* [postApiTaskStart](docs/sdks/tasks/README.md#postapitaskstart) - Start a task: set as current task, queue -> in_progress, optionally trigger execution
* [postApiTaskStatus](docs/sdks/tasks/README.md#postapitaskstatus) - Get task status summary or details
* [postApiTaskStop](docs/sdks/tasks/README.md#postapitaskstop) - Stop task execution
* [postApiTaskUpdate](docs/sdks/tasks/README.md#postapitaskupdate) - Update task fields (not status - use lifecycle endpoints for status changes)
* [postApiTaskValidateCheckPhasePassed](docs/sdks/tasks/README.md#postapitaskvalidatecheckphasepassed) - Validate check phase passed (runs verify commands or checks completion markers)
* [postApiTaskValidateContext](docs/sdks/tasks/README.md#postapitaskvalidatecontext) - Validate that all context file references exist
* [postApiTaskView](docs/sdks/tasks/README.md#postapitaskview) - View task details
* [postApiTaskWorkPhase](docs/sdks/tasks/README.md#postapitaskworkphase) - Run work phase for a task (spawns work agent)
* [postApiTasksBatchEvents](docs/sdks/tasks/README.md#postapitasksbatchevents) - Apply an event to multiple tasks (batch operation)

### [Tauri](docs/sdks/tauri/README.md)

* [getApiMcpTauriStatus](docs/sdks/tauri/README.md#getapimcptauristatus) - Check tauri-plugin-mcp connection status

### [Workspaces](docs/sdks/workspaces/README.md)

* [getApiWorkspaces](docs/sdks/workspaces/README.md#getapiworkspaces) - List all workspaces including the global workspace
* [getApiWorkspacesDetect](docs/sdks/workspaces/README.md#getapiworkspacesdetect) - Detect folder status (.git and .viben directories)

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

- [`agentsGetApiAgent`](docs/sdks/agents/README.md#getapiagent) - List all agents
- [`channelsGetApiChannels`](docs/sdks/channels/README.md#getapichannels) - List all notification channels
- [`channelsGetApiChannelsId`](docs/sdks/channels/README.md#getapichannelsid) - Get a specific channel by ID
- [`cronGetApiCron`](docs/sdks/cron/README.md#getapicron) - List all cron jobs
- [`cronGetApiCronId`](docs/sdks/cron/README.md#getapicronid) - Get a specific cron job by ID
- [`deleteApiAccountsId`](docs/sdks/sdk/README.md#deleteapiaccountsid)
- [`deleteApiAgentId`](docs/sdks/sdk/README.md#deleteapiagentid)
- [`deleteApiAgentIdSessionsSessionId`](docs/sdks/sdk/README.md#deleteapiagentidsessionssessionid)
- [`deleteApiApiLogsRunId`](docs/sdks/sdk/README.md#deleteapiapilogsrunid)
- [`deleteApiBrowsePluginsPluginId`](docs/sdks/sdk/README.md#deleteapibrowsepluginspluginid)
- [`deleteApiCache`](docs/sdks/sdk/README.md#deleteapicache)
- [`deleteApiChannelsId`](docs/sdks/sdk/README.md#deleteapichannelsid)
- [`deleteApiCronId`](docs/sdks/sdk/README.md#deleteapicronid)
- [`deleteApiCronIdLogs`](docs/sdks/sdk/README.md#deleteapicronidlogs)
- [`deleteApiDevicesId`](docs/sdks/sdk/README.md#deleteapidevicesid)
- [`deleteApiFiles`](docs/sdks/sdk/README.md#deleteapifiles)
- [`deleteApiGithubAuth`](docs/sdks/sdk/README.md#deleteapigithubauth)
- [`deleteApiGithubAutofixTasksTaskId`](docs/sdks/sdk/README.md#deleteapigithubautofixtaskstaskid)
- [`deleteApiGithubAutofixWorktrees`](docs/sdks/sdk/README.md#deleteapigithubautofixworktrees)
- [`deleteApiGithubReposConnect`](docs/sdks/sdk/README.md#deleteapigithubreposconnect)
- [`deleteApiGroupChatsId`](docs/sdks/sdk/README.md#deleteapigroupchatsid)
- [`deleteApiGroupChatsIdFilesFilename`](docs/sdks/sdk/README.md#deleteapigroupchatsidfilesfilename)
- [`deleteApiGroupChatsIdMembersMemberId`](docs/sdks/sdk/README.md#deleteapigroupchatsidmembersmemberid)
- [`deleteApiGroupChatsIdPicturesFilename`](docs/sdks/sdk/README.md#deleteapigroupchatsidpicturesfilename)
- [`deleteApiGroupChatsIdSessionsSessionId`](docs/sdks/sdk/README.md#deleteapigroupchatsidsessionssessionid)
- [`deleteApiHistory`](docs/sdks/sdk/README.md#deleteapihistory)
- [`deleteApiHistoryId`](docs/sdks/sdk/README.md#deleteapihistoryid)
- [`deleteApiKanbanTasksTaskIdCommentsCommentId`](docs/sdks/sdk/README.md#deleteapikanbantaskstaskidcommentscommentid)
- [`deleteApiKanbanTasksTaskIdData`](docs/sdks/sdk/README.md#deleteapikanbantaskstaskiddata)
- [`deleteApiLogs`](docs/sdks/sdk/README.md#deleteapilogs)
- [`deleteApiLogsSessionSessionId`](docs/sdks/sdk/README.md#deleteapilogssessionsessionid)
- [`deleteApiMarketplaceCache`](docs/sdks/sdk/README.md#deleteapimarketplacecache)
- [`deleteApiMcpAgentsAgentIdServersName`](docs/sdks/sdk/README.md#deleteapimcpagentsagentidserversname)
- [`deleteApiMcpInspectorMcp`](docs/sdks/sdk/README.md#deleteapimcpinspectormcp)
- [`deleteApiMcpInspectorSessionsSessionId`](docs/sdks/sdk/README.md#deleteapimcpinspectorsessionssessionid)
- [`deleteApiMcpServerBrowse`](docs/sdks/sdk/README.md#deleteapimcpserverbrowse)
- [`deleteApiMcpServerGuiAction`](docs/sdks/sdk/README.md#deleteapimcpserverguiaction)
- [`deleteApiMcpTauriMcp`](docs/sdks/sdk/README.md#deleteapimcptaurimcp)
- [`deleteApiModelsAliasesAlias`](docs/sdks/sdk/README.md#deleteapimodelsaliasesalias)
- [`deleteApiModelsFallbacks`](docs/sdks/sdk/README.md#deleteapimodelsfallbacks)
- [`deleteApiModelsFallbacksModel`](docs/sdks/sdk/README.md#deleteapimodelsfallbacksmodel)
- [`deleteApiModelsId`](docs/sdks/sdk/README.md#deleteapimodelsid)
- [`deleteApiModelsIdConfig`](docs/sdks/sdk/README.md#deleteapimodelsidconfig)
- [`deleteApiOfficialRegistryCache`](docs/sdks/sdk/README.md#deleteapiofficialregistrycache)
- [`deleteApiOfficialRegistryServersNameCache`](docs/sdks/sdk/README.md#deleteapiofficialregistryserversnamecache)
- [`deleteApiProvidersId`](docs/sdks/sdk/README.md#deleteapiprovidersid)
- [`deleteApiQueueTasksId`](docs/sdks/sdk/README.md#deleteapiqueuetasksid)
- [`deleteApiServiceKeysKeyId`](docs/sdks/sdk/README.md#deleteapiservicekeyskeyid)
- [`deleteApiSessionsId`](docs/sdks/sdk/README.md#deleteapisessionsid)
- [`deleteApiTasksId`](docs/sdks/sdk/README.md#deleteapitasksid)
- [`deleteApiTelemetryClean`](docs/sdks/sdk/README.md#deleteapitelemetryclean)
- [`deleteApiWorkspacesId`](docs/sdks/sdk/README.md#deleteapiworkspacesid)
- [`executorsGetApiExecutors`](docs/sdks/executors/README.md#getapiexecutors) - List available executors
- [`executorsGetApiExecutorsOpenclawRuntimeConfig`](docs/sdks/executors/README.md#getapiexecutorsopenclawruntimeconfig) - Get the effective OpenClaw gateway config from the server side
- [`executorsPostApiExecutorsOpenclawTestConnection`](docs/sdks/executors/README.md#postapiexecutorsopenclawtestconnection) - Test connection to an OpenClaw gateway with device auth handshake
- [`getApiAccounts`](docs/sdks/sdk/README.md#getapiaccounts)
- [`getApiAccountsId`](docs/sdks/sdk/README.md#getapiaccountsid)
- [`getApiAgentAgentIdSessionsSessionIdTasks`](docs/sdks/sdk/README.md#getapiagentagentidsessionssessionidtasks)
- [`getApiAgentAgentIdSessionsSessionIdTasksTaskIdMessages`](docs/sdks/sdk/README.md#getapiagentagentidsessionssessionidtaskstaskidmessages)
- [`getApiAgentAgentIdTasks`](docs/sdks/sdk/README.md#getapiagentagentidtasks)
- [`getApiAgentDefault`](docs/sdks/sdk/README.md#getapiagentdefault)
- [`getApiAgentId`](docs/sdks/sdk/README.md#getapiagentid)
- [`getApiAgentIdAvailability`](docs/sdks/sdk/README.md#getapiagentidavailability)
- [`getApiAgentIdSessions`](docs/sdks/sdk/README.md#getapiagentidsessions)
- [`getApiAgentIdSessionsSessionId`](docs/sdks/sdk/README.md#getapiagentidsessionssessionid)
- [`getApiAgentIdSessionsSessionIdMessages`](docs/sdks/sdk/README.md#getapiagentidsessionssessionidmessages)
- [`getApiAgentIdSessionsSessionIdUiMessages`](docs/sdks/sdk/README.md#getapiagentidsessionssessioniduimessages)
- [`getApiAgentPlanPlanId`](docs/sdks/sdk/README.md#getapiagentplanplanid)
- [`getApiAgentSessionSessionId`](docs/sdks/sdk/README.md#getapiagentsessionsessionid)
- [`getApiAgentTasksSubscribe`](docs/sdks/sdk/README.md#getapiagenttaskssubscribe)
- [`getApiAgentTemplates`](docs/sdks/sdk/README.md#getapiagenttemplates)
- [`getApiAgentTemplatesId`](docs/sdks/sdk/README.md#getapiagenttemplatesid)
- [`getApiApiLogsDir`](docs/sdks/sdk/README.md#getapiapilogsdir)
- [`getApiApiLogsRunId`](docs/sdks/sdk/README.md#getapiapilogsrunid)
- [`getApiApiLogsRunIdSummary`](docs/sdks/sdk/README.md#getapiapilogsrunidsummary)
- [`getApiApiLogsSessions`](docs/sdks/sdk/README.md#getapiapilogssessions)
- [`getApiBrowsePluginsInstalled`](docs/sdks/sdk/README.md#getapibrowsepluginsinstalled)
- [`getApiBrowsePluginsPluginId`](docs/sdks/sdk/README.md#getapibrowsepluginspluginid)
- [`getApiBrowsePluginsRegistry`](docs/sdks/sdk/README.md#getapibrowsepluginsregistry)
- [`getApiCacheInfo`](docs/sdks/sdk/README.md#getapicacheinfo)
- [`getApiCacheOffline`](docs/sdks/sdk/README.md#getapicacheoffline)
- [`getApiCacheSettings`](docs/sdks/sdk/README.md#getapicachesettings)
- [`getApiCacheShouldRefresh`](docs/sdks/sdk/README.md#getapicacheshouldrefresh)
- [`getApiChatList`](docs/sdks/sdk/README.md#getapichatlist)
- [`getApiCliToolsConfig`](docs/sdks/sdk/README.md#getapiclitoolsconfig)
- [`getApiCliToolsDetect`](docs/sdks/sdk/README.md#getapiclitoolsdetect)
- [`getApiCommandQueueConfig`](docs/sdks/sdk/README.md#getapicommandqueueconfig)
- [`getApiCommandQueueItems`](docs/sdks/sdk/README.md#getapicommandqueueitems)
- [`getApiCommandQueueItemsId`](docs/sdks/sdk/README.md#getapicommandqueueitemsid)
- [`getApiCommandQueueItemsIdLogs`](docs/sdks/sdk/README.md#getapicommandqueueitemsidlogs)
- [`getApiCommandQueueStatus`](docs/sdks/sdk/README.md#getapicommandqueuestatus)
- [`getApiCommandsSkills`](docs/sdks/sdk/README.md#getapicommandsskills)
- [`getApiCommandsWorkspace`](docs/sdks/sdk/README.md#getapicommandsworkspace)
- [`getApiCronIdLogs`](docs/sdks/sdk/README.md#getapicronidlogs)
- [`getApiDevices`](docs/sdks/sdk/README.md#getapidevices)
- [`getApiDevicesId`](docs/sdks/sdk/README.md#getapidevicesid)
- [`getApiDevicesQr`](docs/sdks/sdk/README.md#getapidevicesqr)
- [`getApiEvents`](docs/sdks/sdk/README.md#getapievents)
- [`getApiExchanges`](docs/sdks/sdk/README.md#getapiexchanges)
- [`getApiExecutorsTypeCommands`](docs/sdks/sdk/README.md#getapiexecutorstypecommands)
- [`getApiExecutorsTypeCommandsCommandId`](docs/sdks/sdk/README.md#getapiexecutorstypecommandscommandid)
- [`getApiExecutorsTypeDiscoverSessions`](docs/sdks/sdk/README.md#getapiexecutorstypediscoversessions)
- [`getApiExecutorsTypeMcpServers`](docs/sdks/sdk/README.md#getapiexecutorstypemcpservers)
- [`getApiExecutorsTypePrompts`](docs/sdks/sdk/README.md#getapiexecutorstypeprompts)
- [`getApiExecutorsTypePromptsPromptId`](docs/sdks/sdk/README.md#getapiexecutorstypepromptspromptid)
- [`getApiExecutorsTypeSessionsSessionIdMessages`](docs/sdks/sdk/README.md#getapiexecutorstypesessionssessionidmessages)
- [`getApiExecutorsTypeSkills`](docs/sdks/sdk/README.md#getapiexecutorstypeskills)
- [`getApiExecutorsTypeSubagents`](docs/sdks/sdk/README.md#getapiexecutorstypesubagents)
- [`getApiExecutorsTypeSubagentsConfigId`](docs/sdks/sdk/README.md#getapiexecutorstypesubagentsconfigid)
- [`getApiFilesConfigDir`](docs/sdks/sdk/README.md#getapifilesconfigdir)
- [`getApiFilesContent`](docs/sdks/sdk/README.md#getapifilescontent)
- [`getApiFilesDirectory`](docs/sdks/sdk/README.md#getapifilesdirectory)
- [`getApiFilesGitDiff`](docs/sdks/sdk/README.md#getapifilesgitdiff)
- [`getApiFilesGitStatus`](docs/sdks/sdk/README.md#getapifilesgitstatus)
- [`getApiFilesList`](docs/sdks/sdk/README.md#getapifileslist)
- [`getApiFilesMcpServers`](docs/sdks/sdk/README.md#getapifilesmcpservers)
- [`getApiGithubAuthStatus`](docs/sdks/sdk/README.md#getapigithubauthstatus)
- [`getApiGithubAutofixConfig`](docs/sdks/sdk/README.md#getapigithubautofixconfig)
- [`getApiGithubAutofixTasks`](docs/sdks/sdk/README.md#getapigithubautofixtasks)
- [`getApiGithubAutofixTasksTaskId`](docs/sdks/sdk/README.md#getapigithubautofixtaskstaskid)
- [`getApiGithubAutofixWorktrees`](docs/sdks/sdk/README.md#getapigithubautofixworktrees)
- [`getApiGithubIssues`](docs/sdks/sdk/README.md#getapigithubissues)
- [`getApiGithubIssuesNumber`](docs/sdks/sdk/README.md#getapigithubissuesnumber)
- [`getApiGithubIssuesNumberComments`](docs/sdks/sdk/README.md#getapigithubissuesnumbercomments)
- [`getApiGithubPrs`](docs/sdks/sdk/README.md#getapigithubprs)
- [`getApiGithubPrsNumber`](docs/sdks/sdk/README.md#getapigithubprsnumber)
- [`getApiGithubReleases`](docs/sdks/sdk/README.md#getapigithubreleases)
- [`getApiGithubReleasesLatest`](docs/sdks/sdk/README.md#getapigithubreleaseslatest)
- [`getApiGithubRepos`](docs/sdks/sdk/README.md#getapigithubrepos)
- [`getApiGithubReposConnected`](docs/sdks/sdk/README.md#getapigithubreposconnected)
- [`getApiGithubReposDetect`](docs/sdks/sdk/README.md#getapigithubreposdetect)
- [`getApiGroupChats`](docs/sdks/sdk/README.md#getapigroupchats)
- [`getApiGroupChatsId`](docs/sdks/sdk/README.md#getapigroupchatsid)
- [`getApiGroupChatsIdFiles`](docs/sdks/sdk/README.md#getapigroupchatsidfiles)
- [`getApiGroupChatsIdFilesFilename`](docs/sdks/sdk/README.md#getapigroupchatsidfilesfilename)
- [`getApiGroupChatsIdMembers`](docs/sdks/sdk/README.md#getapigroupchatsidmembers)
- [`getApiGroupChatsIdPictures`](docs/sdks/sdk/README.md#getapigroupchatsidpictures)
- [`getApiGroupChatsIdPicturesFilename`](docs/sdks/sdk/README.md#getapigroupchatsidpicturesfilename)
- [`getApiGroupChatsIdSessions`](docs/sdks/sdk/README.md#getapigroupchatsidsessions)
- [`getApiGroupChatsIdSessionsSessionId`](docs/sdks/sdk/README.md#getapigroupchatsidsessionssessionid)
- [`getApiGroupChatsIdSessionsSessionIdAgents`](docs/sdks/sdk/README.md#getapigroupchatsidsessionssessionidagents)
- [`getApiGroupChatsIdSessionsSessionIdMessages`](docs/sdks/sdk/README.md#getapigroupchatsidsessionssessionidmessages)
- [`getApiHistory`](docs/sdks/sdk/README.md#getapihistory)
- [`getApiHistoryId`](docs/sdks/sdk/README.md#getapihistoryid)
- [`getApiLogsDir`](docs/sdks/sdk/README.md#getapilogsdir)
- [`getApiLogsSessions`](docs/sdks/sdk/README.md#getapilogssessions)
- [`getApiLogsSessionSessionId`](docs/sdks/sdk/README.md#getapilogssessionsessionid)
- [`getApiMarketplaceCategories`](docs/sdks/sdk/README.md#getapimarketplacecategories)
- [`getApiMarketplaceCategoriesCategoryIdPlugins`](docs/sdks/sdk/README.md#getapimarketplacecategoriescategoryidplugins)
- [`getApiMarketplaceIndex`](docs/sdks/sdk/README.md#getapimarketplaceindex)
- [`getApiMarketplacePlugins`](docs/sdks/sdk/README.md#getapimarketplaceplugins)
- [`getApiMarketplacePluginsPluginId`](docs/sdks/sdk/README.md#getapimarketplacepluginspluginid)
- [`getApiMarketplaceSearch`](docs/sdks/sdk/README.md#getapimarketplacesearch)
- [`getApiMarketplaceSources`](docs/sdks/sdk/README.md#getapimarketplacesources)
- [`getApiMcpAgentsAgentIdServers`](docs/sdks/sdk/README.md#getapimcpagentsagentidservers)
- [`getApiMcpAgentsAgentIdServersName`](docs/sdks/sdk/README.md#getapimcpagentsagentidserversname)
- [`getApiMcpBrowseStatus`](docs/sdks/sdk/README.md#getapimcpbrowsestatus)
- [`getApiMcpInspectorConfig`](docs/sdks/sdk/README.md#getapimcpinspectorconfig)
- [`getApiMcpInspectorHealth`](docs/sdks/sdk/README.md#getapimcpinspectorhealth)
- [`getApiMcpInspectorMcp`](docs/sdks/sdk/README.md#getapimcpinspectormcp)
- [`getApiMcpInspectorSessions`](docs/sdks/sdk/README.md#getapimcpinspectorsessions)
- [`getApiMcpInspectorSse`](docs/sdks/sdk/README.md#getapimcpinspectorsse)
- [`getApiMcpInspectorStdio`](docs/sdks/sdk/README.md#getapimcpinspectorstdio)
- [`getApiMcpInspectorToken`](docs/sdks/sdk/README.md#getapimcpinspectortoken)
- [`getApiMcpProxyStatus`](docs/sdks/sdk/README.md#getapimcpproxystatus)
- [`getApiMcpServerBrowse`](docs/sdks/sdk/README.md#getapimcpserverbrowse)
- [`getApiMcpServerGuiAction`](docs/sdks/sdk/README.md#getapimcpserverguiaction)
- [`getApiMcpTauriMcp`](docs/sdks/sdk/README.md#getapimcptaurimcp)
- [`getApiMcpTauriSse`](docs/sdks/sdk/README.md#getapimcptaurisse)
- [`getApiMeshPeers`](docs/sdks/sdk/README.md#getapimeshpeers)
- [`getApiModelsAliases`](docs/sdks/sdk/README.md#getapimodelsaliases)
- [`getApiModelsDefault`](docs/sdks/sdk/README.md#getapimodelsdefault)
- [`getApiModelsFallbacks`](docs/sdks/sdk/README.md#getapimodelsfallbacks)
- [`getApiModelsIdConfig`](docs/sdks/sdk/README.md#getapimodelsidconfig)
- [`getApiOfficialRegistryServers`](docs/sdks/sdk/README.md#getapiofficialregistryservers)
- [`getApiOfficialRegistryServersName`](docs/sdks/sdk/README.md#getapiofficialregistryserversname)
- [`getApiOfficialRegistryServersNameVersions`](docs/sdks/sdk/README.md#getapiofficialregistryserversnameversions)
- [`getApiPackagesInstalled`](docs/sdks/sdk/README.md#getapipackagesinstalled)
- [`getApiPackagesMcp`](docs/sdks/sdk/README.md#getapipackagesmcp)
- [`getApiPackagesSkills`](docs/sdks/sdk/README.md#getapipackagesskills)
- [`getApiPatches`](docs/sdks/sdk/README.md#getapipatches)
- [`getApiPetAssetIdFilename`](docs/sdks/sdk/README.md#getapipetassetidfilename)
- [`getApiPetCommunity`](docs/sdks/sdk/README.md#getapipetcommunity)
- [`getApiPetConfig`](docs/sdks/sdk/README.md#getapipetconfig)
- [`getApiPetExportId`](docs/sdks/sdk/README.md#getapipetexportid)
- [`getApiPetList`](docs/sdks/sdk/README.md#getapipetlist)
- [`getApiPetPreviewId`](docs/sdks/sdk/README.md#getapipetpreviewid)
- [`getApiPetSearch`](docs/sdks/sdk/README.md#getapipetsearch)
- [`getApiPetShowId`](docs/sdks/sdk/README.md#getapipetshowid)
- [`getApiPetSourcesList`](docs/sdks/sdk/README.md#getapipetsourceslist)
- [`getApiPreferences`](docs/sdks/sdk/README.md#getapipreferences)
- [`getApiPreferencesDeveloper`](docs/sdks/sdk/README.md#getapipreferencesdeveloper)
- [`getApiPreferencesDeveloperIde`](docs/sdks/sdk/README.md#getapipreferencesdeveloperide)
- [`getApiPreferencesDeveloperTerminal`](docs/sdks/sdk/README.md#getapipreferencesdeveloperterminal)
- [`getApiPreferencesNotifications`](docs/sdks/sdk/README.md#getapipreferencesnotifications)
- [`getApiProvidersApiKeys`](docs/sdks/sdk/README.md#getapiprovidersapikeys)
- [`getApiProvidersApiKeysAll`](docs/sdks/sdk/README.md#getapiprovidersapikeysall)
- [`getApiProvidersDefault`](docs/sdks/sdk/README.md#getapiprovidersdefault)
- [`getApiProvidersIdDiscoverModels`](docs/sdks/sdk/README.md#getapiprovidersiddiscovermodels)
- [`getApiProvidersIdModels`](docs/sdks/sdk/README.md#getapiprovidersidmodels)
- [`getApiPythonDetect`](docs/sdks/sdk/README.md#getapipythondetect)
- [`getApiQueueConfig`](docs/sdks/sdk/README.md#getapiqueueconfig)
- [`getApiQueueStatus`](docs/sdks/sdk/README.md#getapiqueuestatus)
- [`getApiQueueTasks`](docs/sdks/sdk/README.md#getapiqueuetasks)
- [`getApiQueueTasksId`](docs/sdks/sdk/README.md#getapiqueuetasksid)
- [`getApiQueueTasksIdRunning`](docs/sdks/sdk/README.md#getapiqueuetasksidrunning)
- [`getApiQueueTasksIdStream`](docs/sdks/sdk/README.md#getapiqueuetasksidstream)
- [`getApiSandboxAvailable`](docs/sdks/sdk/README.md#getapisandboxavailable)
- [`getApiServiceKeys`](docs/sdks/sdk/README.md#getapiservicekeys)
- [`getApiServiceKeysKeyId`](docs/sdks/sdk/README.md#getapiservicekeyskeyid)
- [`getApiSessionsIdMessages`](docs/sdks/sdk/README.md#getapisessionsidmessages)
- [`getApiSessionsIdUiMessages`](docs/sdks/sdk/README.md#getapisessionsiduimessages)
- [`getApiSourcesInstalled`](docs/sdks/sdk/README.md#getapisourcesinstalled)
- [`getApiSourcesProviderProvider`](docs/sdks/sdk/README.md#getapisourcesproviderprovider)
- [`getApiSystemInfo`](docs/sdks/sdk/README.md#getapisysteminfo)
- [`getApiSystemPublicIp`](docs/sdks/sdk/README.md#getapisystempublicip)
- [`getApiTasksEventsStream`](docs/sdks/sdk/README.md#getapitaskseventsstream)
- [`getApiTasksTaskIdEvents`](docs/sdks/sdk/README.md#getapitaskstaskidevents)
- [`getApiTasksTaskIdEventsStream`](docs/sdks/sdk/README.md#getapitaskstaskideventsstream)
- [`getApiTasksTaskIdSessions`](docs/sdks/sdk/README.md#getapitaskstaskidsessions)
- [`getApiTasksTaskIdState`](docs/sdks/sdk/README.md#getapitaskstaskidstate)
- [`getApiTelemetryDates`](docs/sdks/sdk/README.md#getapitelemetrydates)
- [`getApiTelemetryStats`](docs/sdks/sdk/README.md#getapitelemetrystats)
- [`getApiTelemetryTraceId`](docs/sdks/sdk/README.md#getapitelemetrytraceid)
- [`getApiTelemetryTraceIdSpans`](docs/sdks/sdk/README.md#getapitelemetrytraceidspans)
- [`getApiTelemetryTraces`](docs/sdks/sdk/README.md#getapitelemetrytraces)
- [`getApiTunnelStatus`](docs/sdks/sdk/README.md#getapitunnelstatus)
- [`getApiUsageApiKeyKeyId`](docs/sdks/sdk/README.md#getapiusageapikeykeyid)
- [`getApiUsageServerServerId`](docs/sdks/sdk/README.md#getapiusageserverserverid)
- [`getApiUsageSourceSourceId`](docs/sdks/sdk/README.md#getapiusagesourcesourceid)
- [`getApiUsageStats`](docs/sdks/sdk/README.md#getapiusagestats)
- [`getOpenapiJson`](docs/sdks/sdk/README.md#getopenapijson)
- [`getOpenapiYaml`](docs/sdks/sdk/README.md#getopenapiyaml)
- [`healthGetHealth`](docs/sdks/health/README.md#gethealth) - Health check endpoint
- [`ideasDeleteApiIdeas`](docs/sdks/ideas/README.md#deleteapiideas) - Remove ideas by type or all ideas
- [`ideasDeleteApiIdeasId`](docs/sdks/ideas/README.md#deleteapiideasid) - Remove a single idea by ID
- [`ideasDeleteApiIdeaTypesName`](docs/sdks/ideas/README.md#deleteapiideatypesname) - Delete a custom idea type
- [`ideasGetApiIdeas`](docs/sdks/ideas/README.md#getapiideas) - List all ideas for a workspace with optional filtering
- [`ideasGetApiIdeasId`](docs/sdks/ideas/README.md#getapiideasid) - Get a specific idea by ID
- [`ideasGetApiIdeaTypes`](docs/sdks/ideas/README.md#getapiideatypes) - List available idea types (builtin + custom)
- [`ideasPostApiIdeasGenerate`](docs/sdks/ideas/README.md#postapiideasgenerate) - Generate ideas by analyzing the codebase using AI
- [`ideasPostApiIdeasIdDismiss`](docs/sdks/ideas/README.md#postapiideasiddismiss) - Dismiss an idea (mark as not worth pursuing)
- [`ideasPostApiIdeasIdPromote`](docs/sdks/ideas/README.md#postapiideasidpromote) - Promote an idea to a task
- [`ideasPostApiIdeaTypes`](docs/sdks/ideas/README.md#postapiideatypes) - Create a new custom idea type
- [`ideasPutApiIdeaTypesName`](docs/sdks/ideas/README.md#putapiideatypesname) - Update an existing idea type
- [`kanbanGetApiKanbanTasksTaskIdActivities`](docs/sdks/kanban/README.md#getapikanbantaskstaskidactivities) - Get all activities for a task
- [`kanbanGetApiKanbanTasksTaskIdComments`](docs/sdks/kanban/README.md#getapikanbantaskstaskidcomments) - Get all comments for a task
- [`mcpGetApiMcpInfoIdOrSlug`](docs/sdks/mcp/README.md#getapimcpinfoidorslug) - Get MCP package details from marketplace
- [`mcpGetApiMcpInstalled`](docs/sdks/mcp/README.md#getapimcpinstalled) - List globally installed MCP servers
- [`mcpGetApiMcpList`](docs/sdks/mcp/README.md#getapimcplist) - List installed MCP packages
- [`mcpGetApiMcpSearch`](docs/sdks/mcp/README.md#getapimcpsearch) - Search MCP packages in marketplace
- [`mcpGetApiMcpShowName`](docs/sdks/mcp/README.md#getapimcpshowname) - Get MCP package details
- [`mcpGetApiMcpTauriStatus`](docs/sdks/mcp/README.md#getapimcptauristatus) - Check tauri-plugin-mcp connection status
- [`mcpGetApiMcpTauriStatus`](docs/sdks/tauri/README.md#getapimcptauristatus) - Check tauri-plugin-mcp connection status
- [`mcpPostApiMcpDownload`](docs/sdks/mcp/README.md#postapimcpdownload) - Download MCP package to a directory
- [`mcpPostApiMcpInstall`](docs/sdks/mcp/README.md#postapimcpinstall) - Install an MCP package (supports name, name@version, gh:user/repo, ./path)
- [`mcpPostApiMcpUninstall`](docs/sdks/mcp/README.md#postapimcpuninstall) - Uninstall an MCP package
- [`modelsGetApiModels`](docs/sdks/models/README.md#getapimodels) - List all models
- [`modelsGetApiModelsId`](docs/sdks/models/README.md#getapimodelsid) - Get a specific model by ID
- [`pageGetApiPageSDKV1VibenPageSDKJs`](docs/sdks/page/README.md#getapipagesdkv1vibenpagesdkjs) - Serve viben-page-sdk.js
- [`pageGetApiPageSDKV1VibenPageTokensCss`](docs/sdks/page/README.md#getapipagesdkv1vibenpagetokenscss) - Serve viben-page-tokens.css
- [`pageGetApiPageServe`](docs/sdks/page/README.md#getapipageserve) - Serve page content
- [`pagePostApiPageCreate`](docs/sdks/page/README.md#postapipagecreate) - Create a new page
- [`pagePostApiPageDelete`](docs/sdks/page/README.md#postapipagedelete) - Delete a page
- [`pagePostApiPageDuplicate`](docs/sdks/page/README.md#postapipageduplicate) - Duplicate a page (copy all files with a new uid)
- [`pagePostApiPageList`](docs/sdks/page/README.md#postapipagelist) - List pages in workspace
- [`pagePostApiPageReorder`](docs/sdks/page/README.md#postapipagereorder) - Reorder pages within a parent level
- [`pagePostApiPageServe`](docs/sdks/page/README.md#postapipageserve) - Serve page content
- [`pagePostApiPageTemplates`](docs/sdks/page/README.md#postapipagetemplates) - List available page templates
- [`pagePostApiPageUpdateConfig`](docs/sdks/page/README.md#postapipageupdateconfig) - Update page config (name, description, icon, cover, page_width, show_toc)
- [`pagePostApiPageUpdateContent`](docs/sdks/page/README.md#postapipageupdatecontent) - Update page markdown content (preserves YAML frontmatter)
- [`pagePostApiPageView`](docs/sdks/page/README.md#postapipageview) - Get page by uid
- [`patchApiAgentId`](docs/sdks/sdk/README.md#patchapiagentid)
- [`patchApiChannelsId`](docs/sdks/sdk/README.md#patchapichannelsid)
- [`patchApiCliToolsConfig`](docs/sdks/sdk/README.md#patchapiclitoolsconfig)
- [`patchApiCronId`](docs/sdks/sdk/README.md#patchapicronid)
- [`patchApiGroupChatsId`](docs/sdks/sdk/README.md#patchapigroupchatsid)
- [`patchApiGroupChatsIdSessionsSessionId`](docs/sdks/sdk/README.md#patchapigroupchatsidsessionssessionid)
- [`patchApiKanbanTasksTaskIdCommentsCommentId`](docs/sdks/sdk/README.md#patchapikanbantaskstaskidcommentscommentid)
- [`patchApiMcpAgentsAgentIdServersName`](docs/sdks/sdk/README.md#patchapimcpagentsagentidserversname)
- [`patchApiModelsId`](docs/sdks/sdk/README.md#patchapimodelsid)
- [`patchApiPreferencesDeveloper`](docs/sdks/sdk/README.md#patchapipreferencesdeveloper)
- [`patchApiPreferencesNotifications`](docs/sdks/sdk/README.md#patchapipreferencesnotifications)
- [`patchApiProvidersId`](docs/sdks/sdk/README.md#patchapiprovidersid)
- [`patchApiServiceKeysKeyId`](docs/sdks/sdk/README.md#patchapiservicekeyskeyid)
- [`patchApiSessionsId`](docs/sdks/sdk/README.md#patchapisessionsid)
- [`patchApiTasksId`](docs/sdks/sdk/README.md#patchapitasksid)
- [`postApiAccounts`](docs/sdks/sdk/README.md#postapiaccounts)
- [`postApiAccountsIdTest`](docs/sdks/sdk/README.md#postapiaccountsidtest)
- [`postApiAgent`](docs/sdks/sdk/README.md#postapiagent)
- [`postApiAgentAnswerQuestionId`](docs/sdks/sdk/README.md#postapiagentanswerquestionid)
- [`postApiAgentApprovePlanId`](docs/sdks/sdk/README.md#postapiagentapproveplanid)
- [`postApiAgentIdPromote`](docs/sdks/sdk/README.md#postapiagentidpromote)
- [`postApiAgentIdSessions`](docs/sdks/sdk/README.md#postapiagentidsessions)
- [`postApiAgentIdSessionsSessionIdMessages`](docs/sdks/sdk/README.md#postapiagentidsessionssessionidmessages)
- [`postApiAgentRejectPlanId`](docs/sdks/sdk/README.md#postapiagentrejectplanid)
- [`postApiAgentRun`](docs/sdks/sdk/README.md#postapiagentrun)
- [`postApiAgentSessionSessionIdSteer`](docs/sdks/sdk/README.md#postapiagentsessionsessionidsteer)
- [`postApiAgentStopSessionId`](docs/sdks/sdk/README.md#postapiagentstopsessionid)
- [`postApiAgentTasksTaskIdStop`](docs/sdks/sdk/README.md#postapiagenttaskstaskidstop)
- [`postApiAgentTemplates`](docs/sdks/sdk/README.md#postapiagenttemplates)
- [`postApiAgentTemplatesIdInstantiate`](docs/sdks/sdk/README.md#postapiagenttemplatesidinstantiate)
- [`postApiApiLogsOpen`](docs/sdks/sdk/README.md#postapiapilogsopen)
- [`postApiBrowsePluginsInstall`](docs/sdks/sdk/README.md#postapibrowsepluginsinstall)
- [`postApiCacheRefresh`](docs/sdks/sdk/README.md#postapicacherefresh)
- [`postApiChannels`](docs/sdks/sdk/README.md#postapichannels)
- [`postApiChannelsIdDefault`](docs/sdks/sdk/README.md#postapichannelsiddefault)
- [`postApiChannelsIdWebhook`](docs/sdks/sdk/README.md#postapichannelsidwebhook)
- [`postApiChannelsSend`](docs/sdks/sdk/README.md#postapichannelssend)
- [`postApiChannelsSendTest`](docs/sdks/sdk/README.md#postapichannelssendtest)
- [`postApiChannelsTest`](docs/sdks/sdk/README.md#postapichannelstest)
- [`postApiChannelsWebhook`](docs/sdks/sdk/README.md#postapichannelswebhook)
- [`postApiClientToolsComplete`](docs/sdks/sdk/README.md#postapiclienttoolscomplete)
- [`postApiClientToolsRequest`](docs/sdks/sdk/README.md#postapiclienttoolsrequest)
- [`postApiCliToolsCheck`](docs/sdks/sdk/README.md#postapiclitoolscheck)
- [`postApiCliToolsConfig`](docs/sdks/sdk/README.md#postapiclitoolsconfig)
- [`postApiCommandQueueClean`](docs/sdks/sdk/README.md#postapicommandqueueclean)
- [`postApiCommandQueueEnqueue`](docs/sdks/sdk/README.md#postapicommandqueueenqueue)
- [`postApiCommandQueueItemsIdCancel`](docs/sdks/sdk/README.md#postapicommandqueueitemsidcancel)
- [`postApiCommandQueueItemsIdRetry`](docs/sdks/sdk/README.md#postapicommandqueueitemsidretry)
- [`postApiCron`](docs/sdks/sdk/README.md#postapicron)
- [`postApiCronIdDisable`](docs/sdks/sdk/README.md#postapicroniddisable)
- [`postApiCronIdEnable`](docs/sdks/sdk/README.md#postapicronidenable)
- [`postApiCronIdRun`](docs/sdks/sdk/README.md#postapicronidrun)
- [`postApiDevicesMessage`](docs/sdks/sdk/README.md#postapidevicesmessage)
- [`postApiFiles`](docs/sdks/sdk/README.md#postapifiles)
- [`postApiFilesCopy`](docs/sdks/sdk/README.md#postapifilescopy)
- [`postApiFilesDirectory`](docs/sdks/sdk/README.md#postapifilesdirectory)
- [`postApiFilesMove`](docs/sdks/sdk/README.md#postapifilesmove)
- [`postApiFilesOpen`](docs/sdks/sdk/README.md#postapifilesopen)
- [`postApiFilesOpenFolder`](docs/sdks/sdk/README.md#postapifilesopenfolder)
- [`postApiFilesReveal`](docs/sdks/sdk/README.md#postapifilesreveal)
- [`postApiGithubAuthGhCli`](docs/sdks/sdk/README.md#postapigithubauthghcli)
- [`postApiGithubAuthPat`](docs/sdks/sdk/README.md#postapigithubauthpat)
- [`postApiGithubAutofixTasks`](docs/sdks/sdk/README.md#postapigithubautofixtasks)
- [`postApiGithubAutofixTasksTaskIdApprove`](docs/sdks/sdk/README.md#postapigithubautofixtaskstaskidapprove)
- [`postApiGithubAutofixTasksTaskIdCancel`](docs/sdks/sdk/README.md#postapigithubautofixtaskstaskidcancel)
- [`postApiGithubIssuesCluster`](docs/sdks/sdk/README.md#postapigithubissuescluster)
- [`postApiGithubIssuesImport`](docs/sdks/sdk/README.md#postapigithubissuesimport)
- [`postApiGithubIssuesNumberAnalyze`](docs/sdks/sdk/README.md#postapigithubissuesnumberanalyze)
- [`postApiGithubIssuesNumberInvestigate`](docs/sdks/sdk/README.md#postapigithubissuesnumberinvestigate)
- [`postApiGithubIssuesTriage`](docs/sdks/sdk/README.md#postapigithubissuestriage)
- [`postApiGithubPrs`](docs/sdks/sdk/README.md#postapigithubprs)
- [`postApiGithubReleases`](docs/sdks/sdk/README.md#postapigithubreleases)
- [`postApiGithubReleasesGenerateNotes`](docs/sdks/sdk/README.md#postapigithubreleasesgeneratenotes)
- [`postApiGithubReposConnect`](docs/sdks/sdk/README.md#postapigithubreposconnect)
- [`postApiGroupChats`](docs/sdks/sdk/README.md#postapigroupchats)
- [`postApiGroupChatsIdFiles`](docs/sdks/sdk/README.md#postapigroupchatsidfiles)
- [`postApiGroupChatsIdMembers`](docs/sdks/sdk/README.md#postapigroupchatsidmembers)
- [`postApiGroupChatsIdPictures`](docs/sdks/sdk/README.md#postapigroupchatsidpictures)
- [`postApiGroupChatsIdSessions`](docs/sdks/sdk/README.md#postapigroupchatsidsessions)
- [`postApiGroupChatsIdSessionsSessionIdMessages`](docs/sdks/sdk/README.md#postapigroupchatsidsessionssessionidmessages)
- [`postApiHistory`](docs/sdks/sdk/README.md#postapihistory)
- [`postApiKanbanTasksTaskIdActivities`](docs/sdks/sdk/README.md#postapikanbantaskstaskidactivities)
- [`postApiKanbanTasksTaskIdComments`](docs/sdks/sdk/README.md#postapikanbantaskstaskidcomments)
- [`postApiKanbanTasksTaskIdCommentsCommentIdReactions`](docs/sdks/sdk/README.md#postapikanbantaskstaskidcommentscommentidreactions)
- [`postApiLogsAdd`](docs/sdks/sdk/README.md#postapilogsadd)
- [`postApiLogsCleanup`](docs/sdks/sdk/README.md#postapilogscleanup)
- [`postApiLogsInit`](docs/sdks/sdk/README.md#postapilogsinit)
- [`postApiLogsSessionSessionIdExport`](docs/sdks/sdk/README.md#postapilogssessionsessionidexport)
- [`postApiMcpAgentsAgentIdServers`](docs/sdks/sdk/README.md#postapimcpagentsagentidservers)
- [`postApiMcpAgentsAgentIdServersNameDisable`](docs/sdks/sdk/README.md#postapimcpagentsagentidserversnamedisable)
- [`postApiMcpAgentsAgentIdServersNameEnable`](docs/sdks/sdk/README.md#postapimcpagentsagentidserversnameenable)
- [`postApiMcpBrowseStart`](docs/sdks/sdk/README.md#postapimcpbrowsestart)
- [`postApiMcpBrowseStop`](docs/sdks/sdk/README.md#postapimcpbrowsestop)
- [`postApiMcpBrowseTest`](docs/sdks/sdk/README.md#postapimcpbrowsetest)
- [`postApiMcpInspectorMcp`](docs/sdks/sdk/README.md#postapimcpinspectormcp)
- [`postApiMcpInspectorMessage`](docs/sdks/sdk/README.md#postapimcpinspectormessage)
- [`postApiMcpInspectorSse`](docs/sdks/sdk/README.md#postapimcpinspectorsse)
- [`postApiMcpPortStatus`](docs/sdks/sdk/README.md#postapimcpportstatus)
- [`postApiMcpProcessAlive`](docs/sdks/sdk/README.md#postapimcpprocessalive)
- [`postApiMcpProcessKill`](docs/sdks/sdk/README.md#postapimcpprocesskill)
- [`postApiMcpProxyCheckInstalled`](docs/sdks/sdk/README.md#postapimcpproxycheckinstalled)
- [`postApiMcpProxyInstall`](docs/sdks/sdk/README.md#postapimcpproxyinstall)
- [`postApiMcpProxyKillPortProcess`](docs/sdks/sdk/README.md#postapimcpproxykillportprocess)
- [`postApiMcpProxyPortProcess`](docs/sdks/sdk/README.md#postapimcpproxyportprocess)
- [`postApiMcpProxyStart`](docs/sdks/sdk/README.md#postapimcpproxystart)
- [`postApiMcpProxyStop`](docs/sdks/sdk/README.md#postapimcpproxystop)
- [`postApiMcpServerBrowse`](docs/sdks/sdk/README.md#postapimcpserverbrowse)
- [`postApiMcpServerCheckPort`](docs/sdks/sdk/README.md#postapimcpservercheckport)
- [`postApiMcpServerGuiAction`](docs/sdks/sdk/README.md#postapimcpserverguiaction)
- [`postApiMcpTauriMcp`](docs/sdks/sdk/README.md#postapimcptaurimcp)
- [`postApiMcpTauriMessage`](docs/sdks/sdk/README.md#postapimcptaurimessage)
- [`postApiMcpTauriSse`](docs/sdks/sdk/README.md#postapimcptaurisse)
- [`postApiMeshConnect`](docs/sdks/sdk/README.md#postapimeshconnect)
- [`postApiModels`](docs/sdks/sdk/README.md#postapimodels)
- [`postApiModelsAliases`](docs/sdks/sdk/README.md#postapimodelsaliases)
- [`postApiModelsFallbacks`](docs/sdks/sdk/README.md#postapimodelsfallbacks)
- [`postApiModelsIdDisable`](docs/sdks/sdk/README.md#postapimodelsiddisable)
- [`postApiModelsIdEnable`](docs/sdks/sdk/README.md#postapimodelsidenable)
- [`postApiModelsReload`](docs/sdks/sdk/README.md#postapimodelsreload)
- [`postApiPackagesUpdate`](docs/sdks/sdk/README.md#postapipackagesupdate)
- [`postApiPageAssetUpload`](docs/sdks/sdk/README.md#postapipageassetupload)
- [`postApiPetImport`](docs/sdks/sdk/README.md#postapipetimport)
- [`postApiPetInstall`](docs/sdks/sdk/README.md#postapipetinstall)
- [`postApiPetRemoveId`](docs/sdks/sdk/README.md#postapipetremoveid)
- [`postApiPetSetId`](docs/sdks/sdk/README.md#postapipetsetid)
- [`postApiPetSourcesAdd`](docs/sdks/sdk/README.md#postapipetsourcesadd)
- [`postApiPetSourcesRemoveName`](docs/sdks/sdk/README.md#postapipetsourcesremovename)
- [`postApiProviders`](docs/sdks/sdk/README.md#postapiproviders)
- [`postApiProvidersIdDisable`](docs/sdks/sdk/README.md#postapiprovidersiddisable)
- [`postApiProvidersIdEnable`](docs/sdks/sdk/README.md#postapiprovidersidenable)
- [`postApiProvidersIdTest`](docs/sdks/sdk/README.md#postapiprovidersidtest)
- [`postApiProvidersProviderIdModelsModelIdDisable`](docs/sdks/sdk/README.md#postapiprovidersprovideridmodelsmodeliddisable)
- [`postApiProvidersProviderIdModelsModelIdEnable`](docs/sdks/sdk/README.md#postapiprovidersprovideridmodelsmodelidenable)
- [`postApiProvidersReload`](docs/sdks/sdk/README.md#postapiprovidersreload)
- [`postApiProvidersValidateKey`](docs/sdks/sdk/README.md#postapiprovidersvalidatekey)
- [`postApiPythonCheck`](docs/sdks/sdk/README.md#postapipythoncheck)
- [`postApiPythonPackageCheck`](docs/sdks/sdk/README.md#postapipythonpackagecheck)
- [`postApiPythonPackageInstallCommand`](docs/sdks/sdk/README.md#postapipythonpackageinstallcommand)
- [`postApiQueueClearHistory`](docs/sdks/sdk/README.md#postapiqueueclearhistory)
- [`postApiQueueEnqueue`](docs/sdks/sdk/README.md#postapiqueueenqueue)
- [`postApiQueueEnqueueBatch`](docs/sdks/sdk/README.md#postapiqueueenqueuebatch)
- [`postApiQueueTasksIdRetry`](docs/sdks/sdk/README.md#postapiqueuetasksidretry)
- [`postApiSandboxExec`](docs/sdks/sdk/README.md#postapisandboxexec)
- [`postApiSandboxRunFile`](docs/sdks/sdk/README.md#postapisandboxrunfile)
- [`postApiSandboxStop`](docs/sdks/sdk/README.md#postapisandboxstop)
- [`postApiServiceKeys`](docs/sdks/sdk/README.md#postapiservicekeys)
- [`postApiServiceKeysKeyIdUsage`](docs/sdks/sdk/README.md#postapiservicekeyskeyidusage)
- [`postApiServiceKeysValidate`](docs/sdks/sdk/README.md#postapiservicekeysvalidate)
- [`postApiSessions`](docs/sdks/sdk/README.md#postapisessions)
- [`postApiSourcesProviderInstall`](docs/sdks/sdk/README.md#postapisourcesproviderinstall)
- [`postApiTasks`](docs/sdks/sdk/README.md#postapitasks)
- [`postApiTasksTaskIdEvents`](docs/sdks/sdk/README.md#postapitaskstaskidevents)
- [`postApiTasksTaskIdEventsValidate`](docs/sdks/sdk/README.md#postapitaskstaskideventsvalidate)
- [`postApiTunnelRestart`](docs/sdks/sdk/README.md#postapitunnelrestart)
- [`postApiTunnelStart`](docs/sdks/sdk/README.md#postapitunnelstart)
- [`postApiTunnelStop`](docs/sdks/sdk/README.md#postapitunnelstop)
- [`postApiUsageInit`](docs/sdks/sdk/README.md#postapiusageinit)
- [`postApiUsageRecord`](docs/sdks/sdk/README.md#postapiusagerecord)
- [`postApiWorkspacesCreate`](docs/sdks/sdk/README.md#postapiworkspacescreate)
- [`previewGetApiPreviewList`](docs/sdks/preview/README.md#getapipreviewlist) - List all active preview servers
- [`previewGetApiPreviewNodeAvailable`](docs/sdks/preview/README.md#getapipreviewnodeavailable) - Check if Node.js is available for Live Preview
- [`previewGetApiPreviewStartSse`](docs/sdks/preview/README.md#getapipreviewstartsse) - Start a Vite preview server with SSE streaming for real-time feedback
- [`previewGetApiPreviewStatusTaskId`](docs/sdks/preview/README.md#getapipreviewstatustaskid) - Get status of a preview server
- [`previewPostApiPreviewKillPort`](docs/sdks/preview/README.md#postapipreviewkillport) - Kill the process occupying a specific port
- [`previewPostApiPreviewStart`](docs/sdks/preview/README.md#postapipreviewstart) - Start a Vite preview server for a task
- [`previewPostApiPreviewStop`](docs/sdks/preview/README.md#postapipreviewstop) - Stop a Vite preview server
- [`previewPostApiPreviewStopAll`](docs/sdks/preview/README.md#postapipreviewstopall) - Stop all running preview servers
- [`providersGetApiProviders`](docs/sdks/providers/README.md#getapiproviders) - List all providers
- [`providersGetApiProvidersId`](docs/sdks/providers/README.md#getapiprovidersid) - Get a specific provider by ID
- [`putApiAccountsId`](docs/sdks/sdk/README.md#putapiaccountsid)
- [`putApiAgentDefault`](docs/sdks/sdk/README.md#putapiagentdefault)
- [`putApiCacheSettings`](docs/sdks/sdk/README.md#putapicachesettings)
- [`putApiCommandQueueConfig`](docs/sdks/sdk/README.md#putapicommandqueueconfig)
- [`putApiFilesContent`](docs/sdks/sdk/README.md#putapifilescontent)
- [`putApiFilesMcpServers`](docs/sdks/sdk/README.md#putapifilesmcpservers)
- [`putApiFilesRename`](docs/sdks/sdk/README.md#putapifilesrename)
- [`putApiGithubAutofixConfig`](docs/sdks/sdk/README.md#putapigithubautofixconfig)
- [`putApiModelsDefault`](docs/sdks/sdk/README.md#putapimodelsdefault)
- [`putApiModelsFallbacks`](docs/sdks/sdk/README.md#putapimodelsfallbacks)
- [`putApiModelsIdConfig`](docs/sdks/sdk/README.md#putapimodelsidconfig)
- [`putApiPetConfig`](docs/sdks/sdk/README.md#putapipetconfig)
- [`putApiPreferences`](docs/sdks/sdk/README.md#putapipreferences)
- [`putApiPreferencesDeveloperIde`](docs/sdks/sdk/README.md#putapipreferencesdeveloperide)
- [`putApiPreferencesDeveloperTerminal`](docs/sdks/sdk/README.md#putapipreferencesdeveloperterminal)
- [`putApiProvidersDefault`](docs/sdks/sdk/README.md#putapiprovidersdefault)
- [`putApiQueueConfig`](docs/sdks/sdk/README.md#putapiqueueconfig)
- [`putApiTasksId`](docs/sdks/sdk/README.md#putapitasksid)
- [`rewardDeleteApiRewardTypesName`](docs/sdks/reward/README.md#deleteapirewardtypesname) - Delete a custom reward type
- [`rewardGetApiRewardTypes`](docs/sdks/reward/README.md#getapirewardtypes) - List available reward types (builtin + custom)
- [`rewardGetApiRewardTypesName`](docs/sdks/reward/README.md#getapirewardtypesname) - Get a specific reward type by name
- [`rewardPostApiRewardCompute`](docs/sdks/reward/README.md#postapirewardcompute) - Compute reward for a task by spawning the reward agent
- [`rewardPostApiRewardSelect`](docs/sdks/reward/README.md#postapirewardselect) - Select best task using PPO metrics
- [`rewardPostApiRewardTypes`](docs/sdks/reward/README.md#postapirewardtypes) - Create a new custom reward type
- [`rewardPutApiRewardTypesName`](docs/sdks/reward/README.md#putapirewardtypesname) - Update a custom reward type
- [`sessionsGetApiSessions`](docs/sdks/sessions/README.md#getapisessions) - List all sessions
- [`sessionsGetApiSessionsId`](docs/sdks/sessions/README.md#getapisessionsid) - Get a specific session by ID
- [`skillGetApiSkillAvailable`](docs/sdks/skill/README.md#getapiskillavailable) - List available skills from marketplace
- [`skillGetApiSkillEnabled`](docs/sdks/skill/README.md#getapiskillenabled) - Get enabled skills for an agent
- [`skillGetApiSkillInfoIdOrSlug`](docs/sdks/skill/README.md#getapiskillinfoidorslug) - Get skill package details from marketplace
- [`skillGetApiSkillList`](docs/sdks/skill/README.md#getapiskilllist) - List installed skills
- [`skillGetApiSkillSearch`](docs/sdks/skill/README.md#getapiskillsearch) - Search skill packages in marketplace
- [`skillGetApiSkillViewName`](docs/sdks/skill/README.md#getapiskillviewname) - Get skill by name
- [`skillPostApiSkillDisable`](docs/sdks/skill/README.md#postapiskilldisable) - Disable a skill for an agent
- [`skillPostApiSkillDownload`](docs/sdks/skill/README.md#postapiskilldownload) - Download skill package to a directory
- [`skillPostApiSkillEnable`](docs/sdks/skill/README.md#postapiskillenable) - Enable a skill for an agent
- [`skillPostApiSkillInstall`](docs/sdks/skill/README.md#postapiskillinstall) - Install a skill
- [`skillPostApiSkillUninstall`](docs/sdks/skill/README.md#postapiskilluninstall) - Uninstall a skill
- [`tasksGetApiTaskEventsStream`](docs/sdks/tasks/README.md#getapitaskeventsstream) - SSE stream for task events
- [`tasksGetApiTaskExecutionStream`](docs/sdks/tasks/README.md#getapitaskexecutionstream) - SSE stream for task execution progress
- [`tasksGetApiTaskListArchive`](docs/sdks/tasks/README.md#getapitasklistarchive) - List archived tasks
- [`tasksGetApiTasks`](docs/sdks/tasks/README.md#getapitasks) - List all tasks for a workspace (workspace_path required)
- [`tasksGetApiTasksId`](docs/sdks/tasks/README.md#getapitasksid) - Get a specific task by ID
- [`tasksGetApiTasksIdRunning`](docs/sdks/tasks/README.md#getapitasksidrunning) - Check if a task's execution process is currently running
- [`tasksGetApiTasksIdSpecs`](docs/sdks/tasks/README.md#getapitasksidspecs) - Get task specs data (PRD, subtasks, logs, files)
- [`tasksPostApiTaskAddContext`](docs/sdks/tasks/README.md#postapitaskaddcontext) - Add context files to a task
- [`tasksPostApiTaskAddSession`](docs/sdks/tasks/README.md#postapitaskaddsession) - Add a new session to journal file and update index.md
- [`tasksPostApiTaskApprove`](docs/sdks/tasks/README.md#postapitaskapprove) - Approve a task in review: review -> completed
- [`tasksPostApiTaskArchive`](docs/sdks/tasks/README.md#postapitaskarchive) - Archive a completed task: completed -> archived
- [`tasksPostApiTaskBatchEnqueue`](docs/sdks/tasks/README.md#postapitaskbatchenqueue) - Batch enqueue multiple tasks for execution
- [`tasksPostApiTaskCancel`](docs/sdks/tasks/README.md#postapitaskcancel) - Cancel a task: * -> cancelled (terminal state)
- [`tasksPostApiTaskCheckPhase`](docs/sdks/tasks/README.md#postapitaskcheckphase) - Run check phase for a task (spawns check agent)
- [`tasksPostApiTaskCleanup`](docs/sdks/tasks/README.md#postapitaskcleanup) - Cleanup worktrees and related resources
- [`tasksPostApiTaskClearHistory`](docs/sdks/tasks/README.md#postapitaskclearhistory) - Clear completed and failed tasks from queue history
- [`tasksPostApiTaskContext`](docs/sdks/tasks/README.md#postapitaskcontext) - Get session context for AI agents
- [`tasksPostApiTaskCreate`](docs/sdks/tasks/README.md#postapitaskcreate) - Create a new task
- [`tasksPostApiTaskCreatePr`](docs/sdks/tasks/README.md#postapitaskcreatepr) - Create PR from task
- [`tasksPostApiTaskCreateWorktree`](docs/sdks/tasks/README.md#postapitaskcreateworktree) - Create isolated git worktree for a task
- [`tasksPostApiTaskDelete`](docs/sdks/tasks/README.md#postapitaskdelete) - Delete a task
- [`tasksPostApiTaskDequeue`](docs/sdks/tasks/README.md#postapitaskdequeue) - Remove task from queue back to backlog
- [`tasksPostApiTaskEnqueue`](docs/sdks/tasks/README.md#postapitaskenqueue) - Move task from backlog to queue for execution
- [`tasksPostApiTaskEvents`](docs/sdks/tasks/README.md#postapitaskevents) - Get event history for a task
- [`tasksPostApiTaskExecute`](docs/sdks/tasks/README.md#postapitaskexecute) - Trigger task execution via queue system
- [`tasksPostApiTaskFinish`](docs/sdks/tasks/README.md#postapitaskfinish) - Finish a task: clear current task marker
- [`tasksPostApiTaskImplementPhase`](docs/sdks/tasks/README.md#postapitaskimplementphase) - Run implement phase for a task (spawns implement agent)
- [`tasksPostApiTaskInitContext`](docs/sdks/tasks/README.md#postapitaskinitcontext) - Initialize empty context files (implement.jsonl, check.jsonl, fix.jsonl) for a task. Use add-context to add specific files.
- [`tasksPostApiTaskList`](docs/sdks/tasks/README.md#postapitasklist) - List tasks
- [`tasksPostApiTaskListContext`](docs/sdks/tasks/README.md#postapitasklistcontext) - List all context entries for a task
- [`tasksPostApiTaskPause`](docs/sdks/tasks/README.md#postapitaskpause) - Pause a task: in_progress/queue -> paused (saves pausedSnapshot)
- [`tasksPostApiTaskPlan`](docs/sdks/tasks/README.md#postapitaskplan) - Start Plan Agent to plan a task
- [`tasksPostApiTaskPlanPhase`](docs/sdks/tasks/README.md#postapitaskplanphase) - Run plan phase for a task (spawns plan agent)
- [`tasksPostApiTaskQueueConfig`](docs/sdks/tasks/README.md#postapitaskqueueconfig) - Get or update queue configuration
- [`tasksPostApiTaskQueueStatus`](docs/sdks/tasks/README.md#postapitaskqueuestatus) - Get queue status
- [`tasksPostApiTaskReject`](docs/sdks/tasks/README.md#postapitaskreject) - Reject a task in review: review -> backlog
- [`tasksPostApiTaskRemoveContext`](docs/sdks/tasks/README.md#postapitaskremovecontext) - Remove context files from a task
- [`tasksPostApiTaskResume`](docs/sdks/tasks/README.md#postapitaskresume) - Resume a paused task: paused -> queue/in_progress
- [`tasksPostApiTaskRetry`](docs/sdks/tasks/README.md#postapitaskretry) - Retry a failed task: failed -> queue
- [`tasksPostApiTaskReview`](docs/sdks/tasks/README.md#postapitaskreview) - View task details for review
- [`tasksPostApiTaskRunning`](docs/sdks/tasks/README.md#postapitaskrunning) - Check if task execution is running
- [`tasksPostApiTasksBatchEvents`](docs/sdks/tasks/README.md#postapitasksbatchevents) - Apply an event to multiple tasks (batch operation)
- [`tasksPostApiTaskSetAgent`](docs/sdks/tasks/README.md#postapitasksetagent) - Set associated agent configuration for a task
- [`tasksPostApiTaskSetBase`](docs/sdks/tasks/README.md#postapitasksetbase) - Set PR target branch for a task
- [`tasksPostApiTaskSetBranch`](docs/sdks/tasks/README.md#postapitasksetbranch) - Set Git branch for a task
- [`tasksPostApiTaskSpecs`](docs/sdks/tasks/README.md#postapitaskspecs) - Get task specs (PRD, subtasks, logs)
- [`tasksPostApiTaskStart`](docs/sdks/tasks/README.md#postapitaskstart) - Start a task: set as current task, queue -> in_progress, optionally trigger execution
- [`tasksPostApiTaskStatus`](docs/sdks/tasks/README.md#postapitaskstatus) - Get task status summary or details
- [`tasksPostApiTaskStop`](docs/sdks/tasks/README.md#postapitaskstop) - Stop task execution
- [`tasksPostApiTaskUpdate`](docs/sdks/tasks/README.md#postapitaskupdate) - Update task fields (not status - use lifecycle endpoints for status changes)
- [`tasksPostApiTaskValidateCheckPhasePassed`](docs/sdks/tasks/README.md#postapitaskvalidatecheckphasepassed) - Validate check phase passed (runs verify commands or checks completion markers)
- [`tasksPostApiTaskValidateContext`](docs/sdks/tasks/README.md#postapitaskvalidatecontext) - Validate that all context file references exist
- [`tasksPostApiTaskView`](docs/sdks/tasks/README.md#postapitaskview) - View task details
- [`tasksPostApiTaskWorkPhase`](docs/sdks/tasks/README.md#postapitaskworkphase) - Run work phase for a task (spawns work agent)
- [`workspacesGetApiWorkspaces`](docs/sdks/workspaces/README.md#getapiworkspaces) - List all workspaces including the global workspace
- [`workspacesGetApiWorkspacesDetect`](docs/sdks/workspaces/README.md#getapiworkspacesdetect) - Detect folder status (.git and .viben directories)

</details>
<!-- End Standalone functions [standalone-funcs] -->

<!-- Start Retries [retries] -->
## Retries

Some of the endpoints in this SDK support retries.  If you use the SDK without any configuration, it will fall back to the default retry strategy provided by the API.  However, the default retry strategy can be overridden on a per-operation basis, or across the entire SDK.

To change the default retry strategy for a single API call, simply provide a retryConfig object to the call:
```typescript
import { SDK } from "@viben/client-sdk";

const sdk = new SDK();

async function run() {
  await sdk.deleteApiAccountsId({
    id: "<id>",
  }, {
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
}

run();

```

If you'd like to override the default retry strategy for all operations that support retries, you can provide a retryConfig at SDK initialization:
```typescript
import { SDK } from "@viben/client-sdk";

const sdk = new SDK({
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
  await sdk.deleteApiAccountsId({
    id: "<id>",
  });
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
import { SDK } from "@viben/client-sdk";
import * as errors from "@viben/client-sdk/sdk/models/errors";

const sdk = new SDK();

async function run() {
  try {
    await sdk.deleteApiAccountsId({
      id: "<id>",
    });
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
import { SDK } from "@viben/client-sdk";

const sdk = new SDK({
  serverURL: "http://127.0.0.1:18790",
});

async function run() {
  await sdk.deleteApiAccountsId({
    id: "<id>",
  });
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
import { SDK } from "@viben/client-sdk";
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

const sdk = new SDK({ httpClient: httpClient });
```
<!-- End Custom HTTP Client [http-client] -->

<!-- Start Debugging [debug] -->
## Debugging

You can setup your SDK to emit debug logs for SDK requests and responses.

You can pass a logger that matches `console`'s interface as an SDK option.

> [!WARNING]
> Beware that debug logging will reveal secrets, like API tokens in headers, in log messages printed to a console or files. It's recommended to use this feature only during local development and not in production.

```typescript
import { SDK } from "@viben/client-sdk";

const sdk = new SDK({ debugLogger: console });
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
