import { useState } from 'react'
import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import { PatternFormat, NumberFormatBase } from 'react-number-format'
import { TbCreditCard } from 'react-icons/tb'

type CreditCard = {
    cardHolderName?: string
    cardType?: string
    expMonth?: string
    expYear?: string
    last4Number?: string
    primary?: boolean
}

type CreditCardFormValues = {
    cardHolderName: string
    ccNumber: string
    cardExpiry: string
    code: string
}

export type CreditCardDialogProps = {
    title: string
    defaultValues?: Partial<CreditCard>
    dialogOpen: boolean
    onDialogClose: () => void
    onSubmit: (values?: CreditCardFormValues) => void | Promise<void>
}

function limit(val: string, max: string) {
    if (val.length === 1 && val[0] > max[0]) {
        val = '0' + val
    }

    if (val.length === 2) {
        if (Number(val) === 0) {
            val = '01'
        } else if (val > max) {
            val = max
        }
    }

    return val
}

function cardExpiryFormat(val: string) {
    const month = limit(val.substring(0, 2), '12')
    const date = limit(val.substring(2, 4), '31')

    return month + (date.length ? '/' + date : '')
}

const CreditCardDialog = ({
    title,
    defaultValues = {},
    dialogOpen,
    onDialogClose,
    onSubmit,
}: CreditCardDialogProps) => {
    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState<CreditCardFormValues>({
        cardHolderName: defaultValues.cardHolderName ?? '',
        ccNumber: '',
        cardExpiry: '',
        code: '',
    })

    const handleChange = (field: keyof CreditCardFormValues, value: string) => {
        setValues((prev) => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async () => {
        setLoading(true)
        await onSubmit(values)
        setLoading(false)
    }

    return (
        <Dialog
            isOpen={dialogOpen}
            onClose={onDialogClose}
            onRequestClose={onDialogClose}
        >
            <h4>{title}</h4>
            <div className="mt-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Cardholder name
                    </label>
                    <input
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary heading-text bg-transparent"
                        placeholder="Full name on card"
                        value={values.cardHolderName}
                        onChange={(e) =>
                            handleChange('cardHolderName', e.target.value)
                        }
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Card number
                    </label>
                    <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                        <TbCreditCard className="text-xl text-gray-400" />
                        <PatternFormat
                            className="flex-1 focus:outline-none heading-text bg-transparent"
                            placeholder={
                                defaultValues.last4Number
                                    ? `•••• •••• •••• ${defaultValues.last4Number}`
                                    : 'Card number'
                            }
                            format="#### #### #### ####"
                            onValueChange={(v) =>
                                handleChange('ccNumber', v.value)
                            }
                        />
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">
                            Expiry date
                        </label>
                        <NumberFormatBase
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none heading-text bg-transparent"
                            placeholder="MM/YY"
                            format={cardExpiryFormat}
                            onValueChange={(v) =>
                                handleChange('cardExpiry', v.value)
                            }
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">
                            CVC
                        </label>
                        <PatternFormat
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none heading-text bg-transparent"
                            placeholder="CVC"
                            format="###"
                            onValueChange={(v) => handleChange('code', v.value)}
                        />
                    </div>
                </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
                <Button onClick={onDialogClose}>Cancel</Button>
                <Button
                    variant="solid"
                    loading={loading}
                    onClick={handleSubmit}
                >
                    Save
                </Button>
            </div>
        </Dialog>
    )
}

export default CreditCardDialog
