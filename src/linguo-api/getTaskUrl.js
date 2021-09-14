export default function getTaskUrl({ chainId, address, id }) {
  return `${process.env.LINGUO_BASE_URL}/translation/${address}/${id}?chainId=${chainId}`;
}
