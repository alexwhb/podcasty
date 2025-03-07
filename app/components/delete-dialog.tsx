
// this is a simplified conformation without the input.
import { Trash } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '#app/components/ui/alert-dialog.tsx'
import { Button } from '#app/components/ui/button.tsx'

export default function DeleteDialog({
                                       displayTriggerButton = true,
                                       open = false,
                                       onOpenChange = () => {},
                                       additionalFormData = {},
                                     }: {
  displayTriggerButton?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  additionalFormData?: Record<string, string>
}) {

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
            This action cannot be undone. Are you sure you want to delete this?
          </AlertDialogDescription>
        </AlertDialogHeader>
         <form method="post">
          <input type="hidden" name="_action" value="delete" />
          {Object.entries(additionalFormData).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction type="submit">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
