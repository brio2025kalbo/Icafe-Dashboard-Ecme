import { useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import IntegrationCard from './IntegrationCard'
import { integrationsData } from '../integrations-constants'
import type { IntegrationCategory } from '../integrations-types'

const Integrations = () => {
    const [categories, setCategories] = useState<IntegrationCategory[]>(
        integrationsData,
    )

    const handleToggleIntegration = (
        categoryId: string,
        integrationId: string,
        enabled: boolean,
    ) => {
        setCategories((prev) =>
            prev.map((category) =>
                category.id === categoryId
                    ? {
                          ...category,
                          integrations: category.integrations.map((int) =>
                              int.id === integrationId
                                  ? { ...int, enabled }
                                  : int,
                          ),
                      }
                    : category,
            ),
        )
    }

    const handleSettingsClick = (integrationId: string) => {
        console.log('Settings clicked for:', integrationId)
        // Add your settings logic here
    }

    const handleDetailsClick = (integrationId: string) => {
        console.log('Details clicked for:', integrationId)
        // Add your details logic here
    }

    const handleAddNewIntegration = () => {
        console.log('Add new integration clicked')
        // Add your logic for adding new integration here
    }

    return (
        <Card>
            <div className="flex items-center justify-between mb-8">
                <h3>Integrations</h3>
                <Button
                    variant="primary"
                    className="flex items-center gap-2"
                    onClick={handleAddNewIntegration}
                >
                    <span className="text-lg">+</span>
                    Add New Integration
                </Button>
            </div>

            {/* Integrations by Category */}
            <div className="space-y-12">
                {categories.map((category) => (
                    <div key={category.id}>
                        <h4 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
                            {category.title}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {category.integrations.map((integration) => (
                                <IntegrationCard
                                    key={integration.id}
                                    integration={integration}
                                    onToggle={(id, enabled) =>
                                        handleToggleIntegration(
                                            category.id,
                                            id,
                                            enabled,
                                        )
                                    }
                                    onSettings={handleSettingsClick}
                                    onDetails={handleDetailsClick}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    )
}

export default Integrations
