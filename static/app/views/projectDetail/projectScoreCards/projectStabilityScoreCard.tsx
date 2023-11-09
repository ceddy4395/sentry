import round from 'lodash/round';

import {
  getDiffInMinutes,
  shouldFetchPreviousPeriod,
} from 'sentry/components/charts/utils';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import ScoreCard from 'sentry/components/scoreCard';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  Organization,
  PageFilters,
  SessionApiResponse,
  SessionFieldWithOperation,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {getPeriod} from 'sentry/utils/getPeriod';
import {displayCrashFreePercent} from 'sentry/views/releases/utils';
import {
  getSessionTermDescription,
  SessionTerm,
} from 'sentry/views/releases/utils/sessionTerm';

import MissingReleasesButtons from '../missingFeatureButtons/missingReleasesButtons';

type Props = DeprecatedAsyncComponent['props'] & {
  field:
    | SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS
    | SessionFieldWithOperation.CRASH_FREE_RATE_USERS;
  hasSessions: boolean | null;
  isProjectStabilized: boolean;
  organization: Organization;
  selection: PageFilters;
  query?: string;
};

type State = DeprecatedAsyncComponent['state'] & {
  currentSessions: SessionApiResponse | null;
  previousSessions: SessionApiResponse | null;
};

class ProjectStabilityScoreCard extends DeprecatedAsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      currentSessions: null,
      previousSessions: null,
    };
  }

  getEndpoints() {
    const {organization, selection, isProjectStabilized, hasSessions, query, field} =
      this.props;

    if (!isProjectStabilized || !hasSessions) {
      return [];
    }

    const {projects, environments: environment, datetime} = selection;
    const {period} = datetime;
    const commonQuery = {
      environment,
      project: projects[0],
      interval: getDiffInMinutes(datetime) > 24 * 60 ? '1d' : '1h',
      query,
      field,
    };

    // Unfortunately we can't do something like statsPeriod=28d&interval=14d to get scores for this and previous interval with the single request
    // https://github.com/getsentry/sentry/pull/22770#issuecomment-758595553

    const endpoints: ReturnType<DeprecatedAsyncComponent['getEndpoints']> = [
      [
        'crashFreeRate',
        `/organizations/${organization.slug}/sessions/`,
        {
          query: {
            ...commonQuery,
            ...normalizeDateTimeParams(datetime),
          },
        },
      ],
    ];

    if (
      shouldFetchPreviousPeriod({
        start: datetime.start,
        end: datetime.end,
        period: datetime.period,
      })
    ) {
      const doubledPeriod = getPeriod(
        {period, start: undefined, end: undefined},
        {shouldDoublePeriod: true}
      ).statsPeriod;

      endpoints.push([
        'previousCrashFreeRate',
        `/organizations/${organization.slug}/sessions/`,
        {
          query: {
            ...commonQuery,
            statsPeriodStart: doubledPeriod,
            statsPeriodEnd: period ?? DEFAULT_STATS_PERIOD,
          },
        },
      ]);
    }

    return endpoints;
  }

  get cardTitle() {
    return this.props.field === SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS
      ? t('Crash Free Sessions')
      : t('Crash Free Users');
  }

  get cardHelp() {
    return getSessionTermDescription(
      this.props.field === SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS
        ? SessionTerm.CRASH_FREE_SESSIONS
        : SessionTerm.CRASH_FREE_USERS,
      null
    );
  }

  get score() {
    const {crashFreeRate} = this.state;

    return crashFreeRate?.groups[0]?.totals[this.props.field] * 100;
  }

  get trend() {
    const {previousCrashFreeRate} = this.state;

    const previousScore =
      previousCrashFreeRate?.groups[0]?.totals[this.props.field] * 100;

    if (!defined(this.score) || !defined(previousScore)) {
      return undefined;
    }

    return round(this.score - previousScore, 3);
  }

  get trendStatus(): React.ComponentProps<typeof ScoreCard>['trendStatus'] {
    if (!this.trend) {
      return undefined;
    }

    return this.trend > 0 ? 'good' : 'bad';
  }

  componentDidUpdate(prevProps: Props) {
    const {selection, isProjectStabilized, hasSessions, query} = this.props;

    if (
      prevProps.selection !== selection ||
      prevProps.hasSessions !== hasSessions ||
      prevProps.isProjectStabilized !== isProjectStabilized ||
      prevProps.query !== query
    ) {
      this.remountComponent();
    }
  }

  renderLoading() {
    return this.renderBody();
  }

  renderMissingFeatureCard() {
    const {organization} = this.props;
    return (
      <ScoreCard
        title={this.cardTitle}
        help={this.cardHelp}
        score={<MissingReleasesButtons organization={organization} health />}
      />
    );
  }

  renderScore() {
    const {loading} = this.state;

    if (loading || !defined(this.score)) {
      return '\u2014';
    }

    return displayCrashFreePercent(this.score);
  }

  renderTrend() {
    const {loading} = this.state;

    if (loading || !defined(this.score) || !defined(this.trend)) {
      return null;
    }

    return (
      <div>
        {this.trend >= 0 ? (
          <IconArrow direction="up" size="xs" />
        ) : (
          <IconArrow direction="down" size="xs" />
        )}
        {`${formatAbbreviatedNumber(Math.abs(this.trend))}\u0025`}
      </div>
    );
  }

  renderBody() {
    const {hasSessions} = this.props;

    if (hasSessions === false) {
      return this.renderMissingFeatureCard();
    }

    return (
      <ScoreCard
        title={this.cardTitle}
        help={this.cardHelp}
        score={this.renderScore()}
        trend={this.renderTrend()}
        trendStatus={this.trendStatus}
      />
    );
  }
}

export default ProjectStabilityScoreCard;
