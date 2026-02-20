export type Integration = {
    id: string
    name: string
    description: string
    icon: string // Icon component name or URL
    enabled: boolean
}

export type IntegrationCategory = {
    id: string
    title: string
    integrations: Integration[]
}
