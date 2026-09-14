import { FlagUS } from './icons'
import { Flyout, RegionSettings, type Account } from './nav-drawer'

// English only; the currency choice (USD or PKR) re-renders the page in that currency
export function LocaleMenu({ account }: { account: Account }) {
  return (
    <Flyout
      className="hidden lg:block"
      toggleLabel="EN: language and currency"
      label={
        <span className="flex items-center gap-1 pt-1 text-sm font-bold">
          <FlagUS className="h-3.5 w-[21px]" /> EN
        </span>
      }
      panelClassName="-left-2.5 w-[250px] pt-0.5"
    >
      <span aria-hidden className="absolute top-0 left-[62px] size-2.5 rotate-45 bg-white" />
      <div className="relative rounded-[3px] border border-[#bbb] bg-white px-[15px] pt-2.5 pb-3.5 text-[13px] leading-4 text-ink shadow-[0_2px_10px_rgba(0,0,0,0.25)]">
        <RegionSettings account={account} />
      </div>
    </Flyout>
  )
}
