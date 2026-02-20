import type { IntegrationCategory } from './integrations-types'

export const integrationsData: IntegrationCategory[] = [
    {
        id: 'communication',
        title: 'Communication',
        integrations: [
            {
                id: 'gmail',
                name: 'Gmail',
                description:
                    'Integrate Gmail to send, receive, and manage emails directly from your workspace.',
                icon: 'gmail',
                enabled: false,
            },
            {
                id: 'googleMeet',
                name: 'Google Meet',
                description:
                    'Connect your Google Meet account for seamless video conferencing.',
                icon: 'googleMeet',
                enabled: true,
            },
            {
                id: 'zoom',
                name: 'Zoom',
                description:
                    'Integrate Zoom to streamline your virtual meetings and team collaborations.',
                icon: 'zoom',
                enabled: true,
            },
        ],
    },
    {
        id: 'projectManagement',
        title: 'Project Management',
        integrations: [
            {
                id: 'linear',
                name: 'Linear',
                description:
                    'Integrate Linear to manage issues, track progress, and streamline your team\'s.',
                icon: 'linear',
                enabled: false,
            },
            {
                id: 'trello',
                name: 'Trello',
                description:
                    'Capture, organize, and tackle your to-dos from anywhere.',
                icon: 'trello',
                enabled: false,
            },
            {
                id: 'jira',
                name: 'Jira',
                description:
                    'Track issues and manage projects with ease and full team visibility.',
                icon: 'jira',
                enabled: false,
            },
        ],
    },
    {
        id: 'marketing',
        title: 'Marketing & Productivity',
        integrations: [
            {
                id: 'mailchimp',
                name: 'Mailchimp',
                description:
                    'Connect Mailchimp to streamline your email marketing—automate campaigns.',
                icon: 'mailchimp',
                enabled: true,
            },
            {
                id: 'loom',
                name: 'Loom',
                description:
                    'Integrate Loom to easily record, share, and manage video messages.',
                icon: 'loom',
                enabled: false,
            },
            {
                id: 'notion',
                name: 'Notion',
                description:
                    'Capture, organize, and tackle your to-dos from anywhere.',
                icon: 'notion',
                enabled: false,
            },
        ],
    },
]
