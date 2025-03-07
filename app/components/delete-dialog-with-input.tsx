import { Trash } from 'lucide-react'
import { useState } from 'react'
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
import { Button } from '#app/components/ui/button.tsx'
import { Input } from '#app/components/ui/input.tsx'

export default function DeleteDialogWithInput({
	verificationString,
	placeholder,
	displayTriggerButton = true,
}: {
	verificationString: string | undefined
	placeholder: string
	displayTriggerButton?: boolean
}) {
	const [confirmInput, setConfirmInput] = useState('')
	return (
		<AlertDialog>
			{displayTriggerButton && (
				<AlertDialogTrigger asChild>
					<Button variant="destructive">
						<Trash />
					</Button>
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
				<form method="post">
					<input type="hidden" name="_action" value="delete" />
					<div className="m-4">
						<Input
							name="confirmName"
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
							type="submit"
							disabled={confirmInput !== verificationString}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</form>
			</AlertDialogContent>
		</AlertDialog>
	)
}