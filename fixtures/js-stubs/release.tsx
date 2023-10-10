import {Health, ReleaseStatus, ReleaseWithHealth} from 'sentry/types';

export function Release(
  params: Partial<ReleaseWithHealth>,
  healthParams: Health
): ReleaseWithHealth {
  return {
    newGroups: 0,
    commitCount: 0,
    url: '',
    data: {},
    lastDeploy: {
      dateFinished: '',
      dateStarted: '',
      environment: '',
      id: '',
      name: '',
      url: '',
      version: '',
    },
    deployCount: 0,
    shortVersion: '',
    fileCount: 0,
    status: ReleaseStatus.ACTIVE,
    dateCreated: '2020-03-23T01:02:30Z',
    dateReleased: '',
    id: '',
    lastEvent: '2020-03-24T02:04:50Z',
    version: 'sentry-android-shop@1.2.0',
    firstEvent: '',
    lastCommit: {
      dateCreated: '',
      id: '',
      message: null,
      releases: [],
    },
    authors: [],
    owner: null,
    versionInfo: {
      buildHash: null,
      version: {
        pre: null,
        raw: '1.2.0',
        major: 1,
        minor: 2,
        buildCode: null,
        patch: 0,
        components: 3,
      },
      description: '1.2.0',
      package: 'sentry-android-shop',
    },
    ref: '',
    projects: [
      {
        healthData: {
          totalUsers24h: null,
          durationP50: 231,
          hasHealthData: true,
          sessionsAdoption: 0,
          totalProjectSessions24h: 0,
          totalProjectUsers24h: 0,
          totalSessions24h: 0,
          totalSessions: 74949,
          totalUsers: 2544,
          crashFreeSessions: 99.59839357429719,
          sessionsErrored: 301,
          crashFreeUsers: 98.07389937106919,
          durationP90: 333,
          adoption: null,
          sessionsCrashed: 301,
          stats: {
            '24h': [
              [1585472400, 0],
              [1585476000, 0],
              [1585479600, 0],
              [1585483200, 0],
              [1585486800, 0],
              [1585490400, 0],
              [1585494000, 0],
              [1585497600, 0],
              [1585501200, 0],
              [1585504800, 0],
              [1585508400, 0],
              [1585512000, 0],
              [1585515600, 0],
              [1585519200, 0],
              [1585522800, 0],
              [1585526400, 0],
              [1585530000, 0],
              [1585533600, 0],
              [1585537200, 0],
              [1585540800, 0],
              [1585544400, 0],
              [1585548000, 0],
              [1585551600, 0],
              [1585555200, 0],
            ],
          },
        },
        id: 4383603,
        name: 'Sentry-Android-Shop',
        slug: 'sentry-android-shop',
        platform: 'android',
        newGroups: 3,
        platforms: [],
        ...healthParams,
      },
    ],
    currentProjectMeta: {
      nextReleaseVersion: '456',
      prevReleaseVersion: '123',
      firstReleaseVersion: '0',
      lastReleaseVersion: '999',
      sessionsUpperBound: null,
      sessionsLowerBound: null,
    },
    adoptionStages: {
      'sentry-android-shop': {
        adopted: '2020-03-24T01:02:30Z',
        stage: 'replaced',
        unadopted: '2020-03-24T02:02:30Z',
      },
    },
    ...params,
  };
}
