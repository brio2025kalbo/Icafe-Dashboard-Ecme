import { useState } from 'react'
import Button from '@/components/ui/Button'
import {
    TbMail,
    TbVideo,
    TbBrandZoom,
    //TbLinearScale,
    TbTrendingUp,
    //TbBrandMailchimp,
    //TbPlayerRecord2,
    TbNotebook,
} from 'react-icons/tb'
import { BiLogoTrello } from 'react-icons/bi'
import { SiJira } from 'react-icons/si'
import classNames from '@/utils/classNames'
import type { Integration } from '../integrations-types'

interface IntegrationCardProps {
    integration: Integration
    onToggle?: (id: string, enabled: boolean) => void
    onSettings?: (id: string) => void
    onDetails?: (id: string) => void
}

const iconMap: Record<string, React.ComponentType<any>> = {
    gmail: TbMail,
    googleMeet: TbVideo,
    zoom: TbBrandZoom,
    //linear: TbLinearScale,
    jira: SiJira,
    trello: BiLogoTrello,
    //mailchimp: TbBrandMailchimp,
    //loom: TbPlayerRecord2,
    notion: TbNotebook,
}

const IntegrationCard = ({
    integration,
    onToggle,
    onSettings,
    onDetails,
}: IntegrationCardProps) => {
    const [isEnabled, setIsEnabled] = useState(integration.enabled)
    const IconComponent = iconMap[integration.icon] || TbMail

    const handleToggle = () => {
        const newState = !isEnabled
        setIsEnabled(newState)
        onToggle?.(integration.id, newState)
    }

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
            {/* Header with icon and menu */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="text-3xl text-primary">
                        <IconComponent />
                    </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
                    <span className="text-xl">•••</span>
                </button>
            </div>

            {/* Content */}
            <div className="mb-6">
                <h4 className="font-semibold text-lg mb-2">{integration.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {integration.description}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSettings?.(integration.id)}
                        className="flex items-center gap-2"
                    >
                        <span className="text-lg">⚙️</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDetails?.(integration.id)}
                    >
                        Details
                    </Button>
                </div>

                {/* Toggle Switch */}
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={handleToggle}
                        className="sr-only peer"
                    />
                    <div
                        className={classNames(
                            'w-11 h-6 rounded-full transition-colors',
                            isEnabled
                                ? 'bg-blue-500'
                                : 'bg-gray-300 dark:bg-gray-600',
                        )}
                    />
                    <span
                        className={classNames(
                            'absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform',
                            isEnabled && 'translate-x-5',
                        )}
                    />
                </label>
            </div>
        </div>
    )
}

export default IntegrationCard
