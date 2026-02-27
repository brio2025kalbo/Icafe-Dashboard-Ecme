import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { FormItem, Form } from '@/components/ui/Form'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { useUsersStore } from '../store/usersStore'
import { apiCreateUser, apiUpdateUser } from '@/services/AccontsService'
import type { MutateUsersResponse } from '../types'

type FormValues = {
    username: string
    email: string
    password: string
    role: { label: string; value: string }
    is_active: { label: string; value: number }
}

const roleOptions = [
    { label: 'Admin', value: 'admin' },
    { label: 'Staff', value: 'staff' },
]

const statusOptions = [
    { label: 'Active', value: 1 },
    { label: 'Blocked', value: 0 },
]

type UserFormDialogProps = {
    mutate: MutateUsersResponse
}

const UserFormDialog = ({ mutate }: UserFormDialogProps) => {
    const { dialog, setDialog } = useUsersStore()
    const isEdit = dialog.type === 'edit'

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>()

    useEffect(() => {
        if (dialog.open && isEdit && dialog.user) {
            reset({
                username: dialog.user.username,
                email: dialog.user.email,
                password: '',
                role:
                    roleOptions.find((r) => r.value === dialog.user!.role) ||
                    roleOptions[1],
                is_active:
                    statusOptions.find(
                        (s) => s.value === dialog.user!.is_active,
                    ) || statusOptions[0],
            })
        } else if (dialog.open && !isEdit) {
            reset({
                username: '',
                email: '',
                password: '',
                role: roleOptions[1],
                is_active: statusOptions[0],
            })
        }
    }, [dialog.open, dialog.user, isEdit, reset])

    const handleClose = () => {
        setDialog({ type: '', open: false, user: null })
    }

    const onSubmit = async (values: FormValues) => {
        try {
            if (isEdit && dialog.user) {
                await apiUpdateUser(dialog.user.id, {
                    username: values.username,
                    role: values.role.value,
                    is_active: values.is_active.value,
                })
                toast.push(
                    <Notification type="success" title="User updated">
                        {values.username} has been updated.
                    </Notification>,
                    { placement: 'top-end' },
                )
            } else {
                await apiCreateUser({
                    username: values.username,
                    email: values.email,
                    password: values.password,
                    role: values.role.value,
                })
                toast.push(
                    <Notification type="success" title="User created">
                        {values.username} has been created.
                    </Notification>,
                    { placement: 'top-end' },
                )
            }
            mutate()
            handleClose()
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Something went wrong'
            toast.push(
                <Notification type="danger" title="Error">
                    {message}
                </Notification>,
                { placement: 'top-end' },
            )
        }
    }

    return (
        <Dialog
            isOpen={dialog.open}
            width={500}
            onClose={handleClose}
            onRequestClose={handleClose}
        >
            <h4>{isEdit ? 'Edit User' : 'Add User'}</h4>
            <Form className="mt-6" onSubmit={handleSubmit(onSubmit)}>
                <FormItem
                    label="Username"
                    invalid={!!errors.username}
                    errorMessage={errors.username?.message}
                >
                    <Input
                        {...register('username', {
                            required: 'Username is required',
                        })}
                        placeholder="Username"
                    />
                </FormItem>
                {!isEdit && (
                    <>
                        <FormItem
                            label="Email"
                            invalid={!!errors.email}
                            errorMessage={errors.email?.message}
                        >
                            <Input
                                {...register('email', {
                                    required: 'Email is required',
                                })}
                                placeholder="Email"
                                type="email"
                            />
                        </FormItem>
                        <FormItem
                            label="Password"
                            invalid={!!errors.password}
                            errorMessage={errors.password?.message}
                        >
                            <Input
                                {...register('password', {
                                    required: 'Password is required',
                                    minLength: {
                                        value: 6,
                                        message:
                                            'Password must be at least 6 characters',
                                    },
                                })}
                                placeholder="Password"
                                type="password"
                            />
                        </FormItem>
                    </>
                )}
                <FormItem label="Role">
                    <Controller
                        name="role"
                        control={control}
                        render={({ field }) => (
                            <Select
                                {...field}
                                options={roleOptions}
                                placeholder="Select role"
                            />
                        )}
                    />
                </FormItem>
                {isEdit && (
                    <FormItem label="Status">
                        <Controller
                            name="is_active"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    {...field}
                                    options={statusOptions}
                                    placeholder="Select status"
                                />
                            )}
                        />
                    </FormItem>
                )}
                <div className="flex justify-end gap-2 mt-6">
                    <Button
                        type="button"
                        variant="plain"
                        onClick={handleClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="solid"
                        loading={isSubmitting}
                    >
                        {isEdit ? 'Update' : 'Create'}
                    </Button>
                </div>
            </Form>
        </Dialog>
    )
}

export default UserFormDialog
