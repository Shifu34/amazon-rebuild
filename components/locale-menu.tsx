import { FlagUS } from './icons'
import { Flyout } from './nav-drawer'

// nile only ships in English and US dollars, so each group lists the one real option, already chosen
const radio =
  'size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-[#888c8c] bg-white checked:bg-[#e77600] checked:shadow-[inset_0_0_0_3px_#fff] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus'

export function LocaleMenu() {
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
        <fieldset>
          <legend className="py-1">Change language</legend>
          <label className="mt-2.5 flex cursor-pointer items-center gap-2">
            <input type="radio" name="language" value="en" defaultChecked className={radio} /> English - EN
          </label>
        </fieldset>
        <hr className="mt-3.5 mb-1.5 border-[#e7e7e7]" />
        <fieldset>
          <legend className="py-1">Change currency</legend>
          <label className="mt-2.5 flex cursor-pointer items-center gap-2">
            <input type="radio" name="currency" value="USD" defaultChecked className={radio} /> $ - USD - US Dollar
          </label>
        </fieldset>
        <hr className="mt-3.5 mb-1.5 border-[#e7e7e7]" />
        <p className="pt-1">
          <FlagUS className="mr-1.5 inline h-[11px] w-4 align-[-1px]" />
          You are shopping on nile.com
        </p>
      </div>
    </Flyout>
  )
}
