import {useCallback, useMemo, useRef, useState} from 'react';
import {AutoSizer, CellMeasurer, GridCellProps, MultiGrid} from 'react-virtualized';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useOrganization from 'sentry/utils/useOrganization';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import useUrlParams from 'sentry/utils/useUrlParams';
import AccessibilityFilters from 'sentry/views/replays/detail/accessibility/accessibilityFilters';
import AccessibilityHeaderCell, {
  COLUMN_COUNT,
} from 'sentry/views/replays/detail/accessibility/accessibilityHeaderCell';
import AccessibilityTableCell from 'sentry/views/replays/detail/accessibility/accessibilityTableCell';
import AccessibilityDetails from 'sentry/views/replays/detail/accessibility/details';
import useAccessibilityFilters from 'sentry/views/replays/detail/accessibility/useAccessibilityFilters';
import useSortAccessibility from 'sentry/views/replays/detail/accessibility/useSortAccessibility';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedGrid from 'sentry/views/replays/detail/useVirtualizedGrid';

const HEADER_HEIGHT = 25;
const BODY_HEIGHT = 28;

const RESIZEABLE_HANDLE_HEIGHT = 105;

type Props = {
  accessibilityFrames: undefined | any;
  accessibilityIssues: undefined | any;
  projectId: undefined | string;
  startTimestampMs: number;
};

const cellMeasurer = {
  defaultHeight: BODY_HEIGHT,
  defaultWidth: 100,
  fixedHeight: true,
};

function AccessibilityList({
  accessibilityIssues,
  // isAccessibilityDetailsSetup,
  accessibilityFrames,
  // projectId,
  startTimestampMs,
}: Props) {
  const organization = useOrganization();
  const {currentTime, currentHoverTime} = useReplayContext();
  const {onMouseEnter, onMouseLeave, onClickTimestamp} = useCrumbHandlers();

  const [scrollToRow, setScrollToRow] = useState<undefined | number>(undefined);

  const filterProps = useAccessibilityFilters({
    accessibilityFrames: accessibilityFrames || [],
  });
  const {items: filteredItems, searchTerm, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {handleSort, items, sortConfig} = useSortAccessibility({items: filteredItems});

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<MultiGrid>(null);
  const deps = useMemo(() => [items, searchTerm], [items, searchTerm]);
  const {cache, getColumnWidth, onScrollbarPresenceChange, onWrapperResize} =
    useVirtualizedGrid({
      cellMeasurer,
      gridRef,
      columnCount: COLUMN_COUNT,
      dynamicColumnIndex: 2,
      deps,
    });

  // `initialSize` cannot depend on containerRef because the ref starts as
  // `undefined` which then gets set into the hook and doesn't update.
  const initialSize = Math.max(150, window.innerHeight * 0.4);

  const {size: containerSize, ...resizableDrawerProps} = useResizableDrawer({
    direction: 'up',
    initialSize,
    min: 0,
    onResize: () => {},
  });
  const {getParamValue: getDetailRow, setParamValue: setDetailRow} = useUrlParams(
    'n_detail_row',
    ''
  );
  const detailDataIndex = getDetailRow();

  const maxContainerHeight =
    (containerRef.current?.clientHeight || window.innerHeight) - RESIZEABLE_HANDLE_HEIGHT;
  const splitSize =
    accessibilityFrames && detailDataIndex
      ? Math.min(maxContainerHeight, containerSize)
      : undefined;

  const onClickCell = useCallback(
    ({dataIndex, rowIndex}: {dataIndex: number; rowIndex: number}) => {
      if (getDetailRow() === String(dataIndex)) {
        setDetailRow('');
      } else {
        setDetailRow(String(dataIndex));
        setScrollToRow(rowIndex);

        const item = items[dataIndex];
      }
    },
    [getDetailRow, items, organization, setDetailRow]
  );

  const cellRenderer = ({columnIndex, rowIndex, key, style, parent}: GridCellProps) => {
    const accessibility = items[rowIndex - 1];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={columnIndex}
        key={key}
        parent={parent}
        rowIndex={rowIndex}
      >
        {({
          measure: _,
          registerChild,
        }: {
          measure: () => void;
          registerChild?: (element?: Element) => void;
        }) =>
          rowIndex === 0 ? (
            <AccessibilityHeaderCell
              ref={e => e && registerChild?.(e)}
              handleSort={handleSort}
              index={columnIndex}
              sortConfig={sortConfig}
              style={{...style, height: HEADER_HEIGHT}}
            />
          ) : (
            <AccessibilityTableCell
              columnIndex={columnIndex}
              currentHoverTime={currentHoverTime}
              currentTime={currentTime}
              frame={accessibility}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onClickCell={onClickCell}
              onClickTimestamp={onClickTimestamp}
              ref={e => e && registerChild?.(e)}
              rowIndex={rowIndex}
              sortConfig={sortConfig}
              startTimestampMs={startTimestampMs}
              style={{...style, height: BODY_HEIGHT}}
            />
          )
        }
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <AccessibilityFilters accessibilityFrames={accessibilityFrames} {...filterProps} />
      <AccessibilityTable
        ref={containerRef}
        data-test-id="replay-details-accessibility-tab"
      >
        <SplitPanel
          style={{
            gridTemplateRows: splitSize !== undefined ? `1fr auto ${splitSize}px` : '1fr',
          }}
        >
          {accessibilityFrames ? (
            <OverflowHidden>
              <AutoSizer onResize={onWrapperResize}>
                {({height, width}) => (
                  <MultiGrid
                    ref={gridRef}
                    cellRenderer={cellRenderer}
                    columnCount={COLUMN_COUNT}
                    columnWidth={getColumnWidth(width)}
                    deferredMeasurementCache={cache}
                    estimatedColumnSize={100}
                    estimatedRowSize={BODY_HEIGHT}
                    fixedRowCount={1}
                    height={height}
                    noContentRenderer={() => (
                      <NoRowRenderer
                        unfilteredItems={accessibilityFrames}
                        clearSearchTerm={clearSearchTerm}
                      >
                        {t('No accessibility requests recorded')}
                      </NoRowRenderer>
                    )}
                    onScrollbarPresenceChange={onScrollbarPresenceChange}
                    onScroll={() => {
                      if (scrollToRow !== undefined) {
                        setScrollToRow(undefined);
                      }
                    }}
                    scrollToRow={scrollToRow}
                    overscanColumnCount={COLUMN_COUNT}
                    overscanRowCount={5}
                    rowCount={items.length + 1}
                    rowHeight={({index}) => (index === 0 ? HEADER_HEIGHT : BODY_HEIGHT)}
                    width={width}
                  />
                )}
              </AutoSizer>
            </OverflowHidden>
          ) : (
            <Placeholder height="100%" />
          )}
          <AccessibilityDetails
            {...resizableDrawerProps}
            item={detailDataIndex ? items[detailDataIndex] : null}
            onClose={() => {
              setDetailRow('');
            }}
            projectId="1"
            startTimestampMs={startTimestampMs}
          />
        </SplitPanel>
      </AccessibilityTable>
    </FluidHeight>
  );
}

const SplitPanel = styled('div')`
  width: 100%;
  height: 100%;

  position: relative;
  display: grid;
  overflow: auto;
`;

const OverflowHidden = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
`;

const AccessibilityTable = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};

  .beforeHoverTime + .afterHoverTime:before {
    border-top: 1px solid ${p => p.theme.purple200};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 999999999%;
  }

  .beforeHoverTime:last-child:before {
    border-bottom: 1px solid ${p => p.theme.purple200};
    content: '';
    right: 0;
    position: absolute;
    bottom: 0;
    width: 999999999%;
  }

  .beforeCurrentTime + .afterCurrentTime:before {
    border-top: 1px solid ${p => p.theme.purple300};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 999999999%;
  }

  .beforeCurrentTime:last-child:before {
    border-bottom: 1px solid ${p => p.theme.purple300};
    content: '';
    right: 0;
    position: absolute;
    bottom: 0;
    width: 999999999%;
  }
`;

export default AccessibilityList;
