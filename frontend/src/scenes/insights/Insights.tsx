import React, { useEffect, useRef } from 'react'
import { BindLogic, useActions, useMountedLogic, useValues } from 'kea'

import { isMobile, Loading } from 'lib/utils'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import { Row, Col, Card, Input, Button } from 'antd'
import { FUNNEL_VIZ, ACTIONS_TABLE, ACTIONS_BAR_CHART_VALUE, FEATURE_FLAGS } from 'lib/constants'
import { annotationsLogic } from '~/lib/components/Annotations'
import { router } from 'kea-router'

import { RetentionContainer } from 'scenes/retention/RetentionContainer'

import { Paths } from 'scenes/paths/Paths'

import { FunnelTab, PathTab, RetentionTab, SessionTab, TrendTab } from './InsightTabs'
import { funnelLogic } from 'scenes/funnels/funnelLogic'
import { insightLogic } from './insightLogic'
import { getLogicFromInsight } from './utils'
import { InsightHistoryPanel } from './InsightHistoryPanel'
import { DownOutlined, UpOutlined } from '@ant-design/icons'
import { insightCommandLogic } from './insightCommandLogic'

import './Insights.scss'
import {
    ErrorMessage,
    FunnelEmptyState,
    FunnelInvalidExclusionFiltersEmptyState,
    FunnelInvalidFiltersEmptyState,
    TimeOut,
} from './EmptyStates'
import { People } from 'scenes/funnels/FunnelPeople'
import { InsightsTable } from './InsightsTable'
import { TrendInsight } from 'scenes/trends/Trends'
import { trendsLogic } from 'scenes/trends/trendsLogic'
import { FunnelVizType, HotKeys, ItemMode, ViewType } from '~/types'
import { useKeyboardHotkeys } from 'lib/hooks/useKeyboardHotkeys'
import { eventUsageLogic, InsightEventSource } from 'lib/utils/eventUsageLogic'
import { InsightDisplayConfig } from './InsightTabs/InsightDisplayConfig'
import { PageHeader } from 'lib/components/PageHeader'
import { NPSPrompt } from 'lib/experimental/NPSPrompt'
import { featureFlagLogic } from 'lib/logic/featureFlagLogic'
import { PersonModal } from 'scenes/trends/PersonModal'
import { SaveCohortModal } from 'scenes/trends/SaveCohortModal'
import { personsModalLogic } from 'scenes/trends/personsModalLogic'
import { preflightLogic } from 'scenes/PreflightCheck/logic'
import { FunnelCanvasLabel } from 'scenes/funnels/FunnelCanvasLabel'
import { FunnelStepTable } from './InsightTabs/FunnelTab/FunnelStepTable'
import { ObjectTags } from 'lib/components/ObjectTags'
import { FunnelInsight } from './FunnelInsight'
import { InsightsNav } from './InsightsNav'
import { userLogic } from 'scenes/userLogic'
import { ComputationTimeWithRefresh } from './ComputationTimeWithRefresh'
import { SaveToDashboardModal } from 'lib/components/SaveToDashboard/SaveToDashboardModal'

export interface BaseTabProps {
    annotationsToCreate: any[] // TODO: Type properly
}

dayjs.extend(relativeTime)

export function Insights(): JSX.Element {
    useMountedLogic(insightCommandLogic)
    const {
        hashParams: { fromItem, fromDashboard },
    } = useValues(router)

    const { clearAnnotationsToCreate } = useActions(annotationsLogic({ pageKey: fromItem }))
    const { annotationsToCreate } = useValues(annotationsLogic({ pageKey: fromItem }))
    const {
        lastRefresh,
        isLoading,
        activeView,
        allFilters,
        showTimeoutMessage,
        showErrorMessage,
        controlsCollapsed,
        insight,
        insightName,
        saveToDashboardModal,
        insightLoading,
        insightMode,
        lastInsightModeSource,
    } = useValues(insightLogic)
    const {
        setActiveView,
        toggleControlsCollapsed,
        saveNewTag,
        deleteTag,
        updateInsight,
        setInsightMode,
        setInsight,
        openSaveToDashboardModal,
        loadInsight,
    } = useActions(insightLogic)
    const { reportHotkeyNavigation } = useActions(eventUsageLogic)
    const { showingPeople } = useValues(personsModalLogic)
    const { areFiltersValid, isValidFunnel, areExclusionFiltersValid } = useValues(funnelLogic)
    const { saveCohortWithFilters, refreshCohort } = useActions(personsModalLogic)
    const { featureFlags } = useValues(featureFlagLogic)
    const { preflight } = useValues(preflightLogic)
    const { user } = useValues(userLogic)

    const { cohortModalVisible } = useValues(personsModalLogic)
    const { setCohortModalVisible } = useActions(personsModalLogic)
    const { reportCohortCreatedFromPersonModal } = useActions(eventUsageLogic)
    const verticalLayout = activeView === ViewType.FUNNELS && !featureFlags[FEATURE_FLAGS.FUNNEL_HORIZONTAL_UI] // Whether to display the control tab on the side instead of on top

    const logicFromInsight = getLogicFromInsight(activeView, { dashboardItemId: fromItem || null, filters: allFilters })
    const { loadResults } = useActions(logicFromInsight)
    const { resultsLoading } = useValues(logicFromInsight)

    const handleHotkeyNavigation = (view: ViewType, hotkey: HotKeys): void => {
        setActiveView(view)
        reportHotkeyNavigation('insights', hotkey)
    }

    const nameInputRef = useRef<Input | null>(null)
    const descriptionInputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        if (insightMode === ItemMode.Edit) {
            if (lastInsightModeSource === InsightEventSource.AddDescription) {
                setTimeout(() => descriptionInputRef.current?.focus(), 10)
            } else if (!isMobile()) {
                setTimeout(() => nameInputRef.current?.focus(), 10)
            }
        }
    }, [insightMode])

    useKeyboardHotkeys({
        t: {
            action: () => handleHotkeyNavigation(ViewType.TRENDS, 't'),
        },
        f: {
            action: () => handleHotkeyNavigation(ViewType.FUNNELS, 'f'),
        },
        o: {
            action: () => handleHotkeyNavigation(ViewType.SESSIONS, 'o'),
        },
        r: {
            action: () => handleHotkeyNavigation(ViewType.RETENTION, 'r'),
        },
        p: {
            action: () => handleHotkeyNavigation(ViewType.PATHS, 'p'),
        },
        i: {
            action: () => handleHotkeyNavigation(ViewType.STICKINESS, 'i'),
        },
        l: {
            action: () => handleHotkeyNavigation(ViewType.LIFECYCLE, 'l'),
        },
        escape: {
            // Exit edit mode with Esc. Full screen mode is also exited with Esc, but this behavior is native to the browser.
            action: () => setInsightMode(ItemMode.View, InsightEventSource.Hotkey),
            disabled: insightMode !== ItemMode.Edit,
        },
    })

    // Empty states that completely replace the graph
    const BlockingEmptyState = (() => {
        // Insight specific empty states - note order is important here
        if (activeView === ViewType.FUNNELS) {
            if (!areFiltersValid) {
                return <FunnelInvalidFiltersEmptyState />
            }
            if (!areExclusionFiltersValid) {
                return <FunnelInvalidExclusionFiltersEmptyState />
            }
            if (!isValidFunnel && !(resultsLoading || isLoading)) {
                return <FunnelEmptyState />
            }
        }

        // Insight agnostic empty states
        if (showErrorMessage) {
            return <ErrorMessage />
        }
        if (showTimeoutMessage) {
            return <TimeOut isLoading={isLoading} />
        }

        return null
    })()

    // Empty states that can coexist with the graph (e.g. Loading)
    const CoexistingEmptyState = (() => {
        if (isLoading || resultsLoading) {
            return <Loading />
        }
        return null
    })()

    return (
        <div className="insights-page">
            <PersonModal
                visible={showingPeople && !cohortModalVisible}
                view={ViewType.FUNNELS}
                filters={allFilters}
                onSaveCohort={() => {
                    refreshCohort()
                    setCohortModalVisible(true)
                }}
            />
            <SaveCohortModal
                visible={cohortModalVisible}
                onOk={(title: string) => {
                    saveCohortWithFilters(title, allFilters)
                    setCohortModalVisible(false)
                    reportCohortCreatedFromPersonModal(allFilters)
                }}
                onCancel={() => setCohortModalVisible(false)}
            />
            {saveToDashboardModal && (
                <SaveToDashboardModal
                    closeModal={() => openSaveToDashboardModal(false)}
                    name={insight.name || ''}
                    filters={insight}
                    fromItem={fromItem}
                    fromDashboard={fromDashboard}
                    fromItemName={insight.name || ''}
                    annotations={null}
                />
            )}
            {insight.id && (
                <Row style={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                    {insightMode === ItemMode.View ? (
                        <div style={{ display: 'flex', alignItems: 'baseline' }}>
                            <PageHeader title={insight.name || `Insight #${insight.id}`} />
                        </div>
                    ) : (
                        <Input
                            placeholder="Insight name (e.g. Weekly KPIs)"
                            value={insightName || ''}
                            size="large"
                            style={{ maxWidth: 400, marginTop: 30 }}
                            onChange={(e) => setInsight({ ...insight, name: e.target.value })}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    updateInsight(insight)
                                }
                            }}
                            ref={nameInputRef}
                            tabIndex={0}
                        />
                    )}

                    <Col>
                        {insightMode === ItemMode.View ? (
                            <>
                                <Button style={{ marginRight: 8 }} onClick={() => setInsightMode(ItemMode.Edit, null)}>
                                    Edit
                                </Button>
                                <Button type="primary" onClick={() => openSaveToDashboardModal(true)}>
                                    Add to dashboard
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    style={{ marginRight: 8 }}
                                    onClick={() => {
                                        setInsightMode(ItemMode.View, null)
                                        insight.id && loadInsight(insight.id)
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    style={{ marginRight: 8, color: 'var(--primary)' }}
                                    onClick={() => openSaveToDashboardModal(true)}
                                >
                                    Save to dashboard
                                </Button>
                                <Button type="primary" onClick={() => updateInsight(insight)}>
                                    Save
                                </Button>
                            </>
                        )}
                    </Col>
                </Row>
            )}

            {featureFlags[FEATURE_FLAGS.SAVED_INSIGHTS] && (
                <Row>
                    {user?.organization?.available_features?.includes('dashboard_collaboration') && (
                        <Col style={{ width: '100%' }}>
                            {insightMode === ItemMode.View ? (
                                <span className="text-muted-alt" style={{ fontStyle: 'italic' }}>
                                    {insight.description
                                        ? insight.description
                                        : 'Give your insight a meaningful description'}
                                </span>
                            ) : (
                                <Input
                                    placeholder="Give your insight a meaningful description"
                                    style={{ marginTop: 8 }}
                                    value={insight.description}
                                    onChange={(e) => setInsight({ ...insight, description: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                            updateInsight(insight)
                                        }
                                    }}
                                    tabIndex={5}
                                    allowClear
                                />
                            )}
                            <div className="mb" style={{ marginTop: 8 }} data-attr="insight-tags">
                                <ObjectTags
                                    tags={insight.tags || []}
                                    onTagSave={saveNewTag}
                                    onTagDelete={deleteTag}
                                    saving={insightLoading}
                                    tagsAvailable={[]}
                                />
                            </div>
                        </Col>
                    )}
                </Row>
            )}

            <Row style={{ marginTop: 16 }}>
                <InsightsNav />
            </Row>

            <Row gutter={16}>
                {activeView === ViewType.HISTORY ? (
                    <Col span={24}>
                        <Card className="" style={{ overflow: 'visible' }}>
                            <InsightHistoryPanel />
                        </Card>
                    </Col>
                ) : (
                    <>
                        <Col span={24} xl={verticalLayout ? 8 : undefined}>
                            <Card
                                className={`insight-controls${controlsCollapsed ? ' collapsed' : ''}`}
                                onClick={() => controlsCollapsed && toggleControlsCollapsed()}
                            >
                                <div
                                    role="button"
                                    title={controlsCollapsed ? 'Expand panel' : 'Collapse panel'}
                                    className="collapse-control"
                                    onClick={() => !controlsCollapsed && toggleControlsCollapsed()}
                                >
                                    {controlsCollapsed ? <DownOutlined /> : <UpOutlined />}
                                </div>
                                {controlsCollapsed && (
                                    <div>
                                        <h3 className="l3">Query definition</h3>
                                        <span className="text-small text-muted">
                                            Click here to view and change the query events, filters and other settings.
                                        </span>
                                    </div>
                                )}
                                <div className="tabs-inner">
                                    {/* These are insight specific filters. They each have insight specific logics */}
                                    {
                                        {
                                            [`${ViewType.TRENDS}`]: (
                                                <TrendTab
                                                    view={ViewType.TRENDS}
                                                    annotationsToCreate={annotationsToCreate}
                                                />
                                            ),
                                            [`${ViewType.STICKINESS}`]: (
                                                <TrendTab
                                                    view={ViewType.STICKINESS}
                                                    annotationsToCreate={annotationsToCreate}
                                                />
                                            ),
                                            [`${ViewType.LIFECYCLE}`]: (
                                                <TrendTab
                                                    view={ViewType.LIFECYCLE}
                                                    annotationsToCreate={annotationsToCreate}
                                                />
                                            ),
                                            [`${ViewType.SESSIONS}`]: (
                                                <SessionTab annotationsToCreate={annotationsToCreate} />
                                            ),
                                            [`${ViewType.FUNNELS}`]: <FunnelTab />,
                                            [`${ViewType.RETENTION}`]: (
                                                <RetentionTab annotationsToCreate={annotationsToCreate} />
                                            ),
                                            [`${ViewType.PATHS}`]: (
                                                <PathTab annotationsToCreate={annotationsToCreate} />
                                            ),
                                        }[activeView]
                                    }
                                </div>
                            </Card>
                        </Col>
                        <Col span={24} xl={verticalLayout ? 16 : undefined}>
                            {/* TODO: extract to own file. Props: activeView, allFilters, showDateFilter, dateFilterDisabled, annotationsToCreate; lastRefresh, showErrorMessage, showTimeoutMessage, isLoading; ... */}
                            {/* These are filters that are reused between insight features. They
                                each have generic logic that updates the url
                            */}
                            <Card
                                title={
                                    <InsightDisplayConfig
                                        activeView={activeView}
                                        allFilters={allFilters}
                                        annotationsToCreate={annotationsToCreate}
                                        clearAnnotationsToCreate={clearAnnotationsToCreate}
                                    />
                                }
                                data-attr="insights-graph"
                                className="insights-graph-container"
                            >
                                <div>
                                    <Row
                                        align="top"
                                        justify="space-between"
                                        style={{
                                            marginTop: -8,
                                            marginBottom: 16,
                                        }}
                                    >
                                        <Col>
                                            <FunnelCanvasLabel />
                                        </Col>
                                        {lastRefresh && (
                                            <ComputationTimeWithRefresh
                                                lastRefresh={lastRefresh}
                                                loadResults={loadResults}
                                            />
                                        )}
                                    </Row>
                                    {!BlockingEmptyState && CoexistingEmptyState}
                                    <div style={{ display: 'block' }}>
                                        {!!BlockingEmptyState
                                            ? BlockingEmptyState
                                            : {
                                                  [`${ViewType.TRENDS}`]: <TrendInsight view={ViewType.TRENDS} />,
                                                  [`${ViewType.STICKINESS}`]: (
                                                      <TrendInsight view={ViewType.STICKINESS} />
                                                  ),
                                                  [`${ViewType.LIFECYCLE}`]: <TrendInsight view={ViewType.LIFECYCLE} />,
                                                  [`${ViewType.SESSIONS}`]: <TrendInsight view={ViewType.SESSIONS} />,
                                                  [`${ViewType.FUNNELS}`]: <FunnelInsight />,
                                                  [`${ViewType.RETENTION}`]: <RetentionContainer />,
                                                  [`${ViewType.PATHS}`]: <Paths />,
                                              }[activeView]}
                                    </div>
                                </div>
                            </Card>
                            {!preflight?.is_clickhouse_enabled &&
                                !showErrorMessage &&
                                !showTimeoutMessage &&
                                areFiltersValid &&
                                activeView === ViewType.FUNNELS &&
                                allFilters.display === FUNNEL_VIZ && <People />}
                            {preflight?.is_clickhouse_enabled &&
                                activeView === ViewType.FUNNELS &&
                                !showErrorMessage &&
                                allFilters.funnel_viz_type === FunnelVizType.Steps && <FunnelStepTable />}
                            {(!allFilters.display ||
                                (allFilters.display !== ACTIONS_TABLE &&
                                    allFilters.display !== ACTIONS_BAR_CHART_VALUE)) &&
                                (activeView === ViewType.TRENDS || activeView === ViewType.SESSIONS) && (
                                    /* InsightsTable is loaded for all trend views (except below), plus the sessions view.
                                    Exclusions:
                                        1. Table view. Because table is already loaded anyways in `Trends.tsx` as the main component.
                                        2. Bar value chart. Because this view displays data in completely different dimensions.
                                    */
                                    <Card style={{ marginTop: 8 }}>
                                        <BindLogic
                                            logic={trendsLogic}
                                            props={{ dashboardItemId: null, view: activeView, filters: allFilters }}
                                        >
                                            <h3 className="l3">Details table</h3>
                                            <InsightsTable showTotalCount={activeView !== ViewType.SESSIONS} />
                                        </BindLogic>
                                    </Card>
                                )}
                        </Col>
                    </>
                )}
            </Row>
            <NPSPrompt />
        </div>
    )
}
