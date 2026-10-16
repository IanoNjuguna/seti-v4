import { CopyRow } from '@/components/copy/CopyRow';
import { ADDRESS_COPY } from '@/components/receive/address/address.constants';
import { StateMessage, Text } from '@/components/ui';
import { PROFILE_NETWORK_COPY } from './ProfileNetwork.constants';
import type { ProfileNetworkSectionProps } from './ProfileScreen.types';

/**
 * The network row: which chain this account's data lives on.
 *
 * The label and its value stand on ONE line — `Network: Tempo` — and the value is
 * the CHAIN the account acts on (`CHAIN_NAME`), not the product's per-network word
 * (Practice | Live). This row says which chain carries the account; the practice
 * frame says which network it is, at the payment where it matters.
 *
 * The Practice ⇄ Live switch is hidden, not deleted: this deployment serves ONE
 * network, so a control that moves an account between two is a choice the product
 * cannot honour. `ProfileNetworkSwitch`, its constants and `useProfileNetwork` stay
 * on disk, so the decision is reversible without a revert. The readiness sentence
 * is hidden WITH the switch: it reports `mainnetReadiness()`, which guards the
 * SWITCH and never the money path, so on a deployment with no batch proof it would
 * tell the customer Live is unavailable while the app accepts live payments.
 *
 * The deposit address is this row's one FIGURE — a 42-character string nobody
 * retypes by choice — drawn in mono at full `ink` by the app's copy row
 * (`CopyRow`, the receive halves' own), which puts the control on the character
 * after the address ends rather than at the row's far edge, and wraps rather than
 * truncating: clipping would hide the string the person came for, and the control
 * rides the end of the value instead of dropping to a line beneath it. Its words
 * are the receive halves' too (`ADDRESS_COPY`): one string, one action.
 */
export function ProfileNetworkSection({
  network,
  value,
  depositAddress,
  error,
}: ProfileNetworkSectionProps) {
  return (
    <section className="border-t border-hairline-light pt-6">
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <Text variant="card-title" as="h2">
          {PROFILE_NETWORK_COPY.title}:
        </Text>
        <Text variant="card-title" as="p" color="primary">
          {value}
        </Text>
      </div>

      {error ? (
        <div className="mt-4">
          <StateMessage variant="failure" title={PROFILE_NETWORK_COPY.errorTitle} body={error} />
        </div>
      ) : null}

      {network === 'mainnet' ? (
        <div className="mt-5 flex flex-col gap-1">
          {depositAddress ? (
            <CopyRow
              display={depositAddress}
              value={depositAddress}
              label={ADDRESS_COPY.copyAction}
              failureText={ADDRESS_COPY.copyFailed}
              copiedText={ADDRESS_COPY.copiedAction}
              emphasis
              wrap
            />
          ) : (
            <>
              <Text variant="micro" as="p">
                {PROFILE_NETWORK_COPY.noDepositTitle}
              </Text>
              <Text variant="micro" as="p" color="secondary">
                {PROFILE_NETWORK_COPY.noDepositBody}
              </Text>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
