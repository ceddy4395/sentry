import {Fragment} from 'react';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import HeaderPlaceholder from 'sentry/components/replays/header/headerPlaceholder';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import useAllProjectVisibility from 'sentry/utils/project/useAllProjectVisibility';
import {useLocation} from 'sentry/utils/useLocation';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  orgSlug: string;
  replayRecord: ReplayRecord | undefined;
};

function DetailsPageBreadcrumbs({orgSlug, replayRecord}: Props) {
  const location = useLocation();
  const eventView = EventView.fromLocation(location);

  const {getById} = useAllProjectVisibility({});
  const project = getById(String(replayRecord?.project_id));

  const labelTitle = replayRecord ? (
    <Fragment>{getShortEventId(replayRecord?.id)}</Fragment>
  ) : (
    <HeaderPlaceholder width="100%" height="16px" />
  );

  return (
    <Breadcrumbs
      crumbs={[
        {
          to: {
            pathname: normalizeUrl(`/organizations/${orgSlug}/replays/`),
            query: eventView.generateQueryStringObject(),
          },
          label: t('Session Replay'),
        },
        {
          to: {
            pathname: normalizeUrl(`/organizations/${orgSlug}/replays/`),
            query: {
              ...eventView.generateQueryStringObject(),
              project: replayRecord?.project_id,
            },
          },
          label: project ? (
            <ProjectBadge disableLink project={project} avatarSize={16} />
          ) : null,
        },
        {
          label: labelTitle,
        },
      ]}
    />
  );
}

export default DetailsPageBreadcrumbs;
