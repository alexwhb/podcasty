import {Trash} from 'lucide-react'
import {useState} from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '#app/components/ui/alert-dialog.tsx'
import {Button} from '#app/components/ui/button.tsx'
import {Input} from "#app/components/ui/input.tsx";

interface DeleteDialogProps {
    verificationString: string
    placeholder: string
    onDelete: () => void
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: React.ReactNode
}

export default function DeleteDialog({
    verificationString,
    placeholder,
    onDelete,
    isOpen,
    onOpenChange,
    trigger
}: DeleteDialogProps) {
    const [confirmInput, setConfirmInput] = useState('')
    
    const handleDelete = () => {
        onDelete()
        setConfirmInput('')
        onOpenChange?.(false)
    }

    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            {/* Only show trigger if isOpen is not provided (uncontrolled mode) */}
            {isOpen === undefined && (
                <AlertDialogTrigger asChild>
                    {trigger || (
                        <Button variant="destructive">
                            <Trash />
                        </Button>
                    )}
                </AlertDialogTrigger>
            )}
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. Please type{' '}
                        <strong>{verificationString}</strong> to confirm deletion.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="m-4">
                    <Input
                        placeholder={placeholder}
                        value={confirmInput}
                        onChange={(e) => setConfirmInput(e.target.value)}
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                        <Button variant="outline">Cancel</Button>
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={confirmInput !== verificationString}
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}