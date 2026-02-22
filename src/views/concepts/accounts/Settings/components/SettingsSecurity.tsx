import { useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { Form, FormItem } from '@/components/ui/Form'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { useAuth } from '@/auth'
import { TOKEN_NAME_IN_STORAGE } from '@/constants/api.constant'

type PasswordSchema = {
    currentPassword: string
    newPassword: string
    confirmNewPassword: string
}

const validationSchema = z
    .object({
        currentPassword: z
            .string()
            .min(1, { message: 'Please enter your current password!' }),
        newPassword: z
            .string()
            .min(6, { message: 'New password must be at least 6 characters!' }),
        confirmNewPassword: z
            .string()
            .min(1, { message: 'Please confirm your new password!' }),
    })
    .refine((data) => data.confirmNewPassword === data.newPassword, {
        message: 'Passwords do not match',
        path: ['confirmNewPassword'],
    })

const SettingsSecurity = () => {
    const { user } = useAuth()
    const [confirmationOpen, setConfirmationOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [pendingValues, setPendingValues] = useState<PasswordSchema | null>(null)

    const {
        handleSubmit,
        reset,
        formState: { errors },
        control,
    } = useForm<PasswordSchema>({
        resolver: zodResolver(validationSchema),
    })

    const onSubmit = async (values: PasswordSchema) => {
        setPendingValues(values)
        setConfirmationOpen(true)
    }

    const handlePostSubmit = async () => {
        if (!pendingValues || !user?.userId) return
        setIsSubmitting(true)
        try {
            const token = localStorage.getItem(TOKEN_NAME_IN_STORAGE) || ''
            const res = await fetch(`/api/users/${user.userId}/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    currentPassword: pendingValues.currentPassword,
                    newPassword: pendingValues.newPassword,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.ok) {
                toast.push(
                    <Notification type="danger" title="Error">
                        {data.error || 'Failed to change password'}
                    </Notification>
                )
            } else {
                toast.push(
                    <Notification type="success" title="Password updated">
                        Your password has been changed. Please sign in again.
                    </Notification>
                )
                reset()
                // Force re-login since all sessions are revoked on password change
                setTimeout(() => {
                    localStorage.removeItem(TOKEN_NAME_IN_STORAGE)
                    window.location.href = '/sign-in'
                }, 2000)
            }
        } finally {
            setIsSubmitting(false)
            setConfirmationOpen(false)
            setPendingValues(null)
        }
    }

    return (
        <div>
            <div className="mb-8">
                <h4>Password</h4>
                <p>
                    Remember, your password is your digital key to your account.
                    Keep it safe, keep it secure!
                </p>
            </div>
            <Form className="mb-8" onSubmit={handleSubmit(onSubmit)}>
                <FormItem
                    label="Current password"
                    invalid={Boolean(errors.currentPassword)}
                    errorMessage={errors.currentPassword?.message}
                >
                    <Controller
                        name="currentPassword"
                        control={control}
                        render={({ field }) => (
                            <Input
                                type="password"
                                autoComplete="off"
                                placeholder="•••••••••"
                                {...field}
                            />
                        )}
                    />
                </FormItem>
                <FormItem
                    label="New password"
                    invalid={Boolean(errors.newPassword)}
                    errorMessage={errors.newPassword?.message}
                >
                    <Controller
                        name="newPassword"
                        control={control}
                        render={({ field }) => (
                            <Input
                                type="password"
                                autoComplete="off"
                                placeholder="•••••••••"
                                {...field}
                            />
                        )}
                    />
                </FormItem>
                <FormItem
                    label="Confirm new password"
                    invalid={Boolean(errors.confirmNewPassword)}
                    errorMessage={errors.confirmNewPassword?.message}
                >
                    <Controller
                        name="confirmNewPassword"
                        control={control}
                        render={({ field }) => (
                            <Input
                                type="password"
                                autoComplete="off"
                                placeholder="•••••••••"
                                {...field}
                            />
                        )}
                    />
                </FormItem>
                <div className="flex justify-end">
                    <Button variant="solid" type="submit">
                        Update
                    </Button>
                </div>
            </Form>
            <ConfirmDialog
                isOpen={confirmationOpen}
                type="warning"
                title="Update password"
                confirmButtonProps={{
                    loading: isSubmitting,
                    onClick: handlePostSubmit,
                }}
                onClose={() => setConfirmationOpen(false)}
                onRequestClose={() => setConfirmationOpen(false)}
                onCancel={() => setConfirmationOpen(false)}
            >
                <p>
                    Are you sure you want to change your password? You will be
                    signed out and need to sign in again with the new password.
                </p>
            </ConfirmDialog>
        </div>
    )
}

export default SettingsSecurity
