
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#app/components/ui/tooltip"

const EpisodeStatusIndicator = ({ 
  variant = "green", 
  title 
}: {
  variant?: "green" | "red";
  title?: string;
}) => {
  const baseStyles = "relative inline-block w-8 h-8"
  const outerStyles = "absolute inset-0 rounded-full opacity-20"
  const innerStyles = "absolute inset-3 rounded-full"

  const variants = {
    green: {
      outer: `${outerStyles} bg-green-500`,
      inner: `${innerStyles} bg-green-700`,
      tooltip: title || "Published"
    },
    red: {
      outer: `${outerStyles} bg-red-500`,
      inner: `${innerStyles} bg-red-700`,
      tooltip: title || "Unpublished"
    }
  }

  const selectedVariant = variants[variant] || variants.green

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={baseStyles}>
            <span className={selectedVariant.outer}></span>
            <span className={selectedVariant.inner}></span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{selectedVariant.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default EpisodeStatusIndicator