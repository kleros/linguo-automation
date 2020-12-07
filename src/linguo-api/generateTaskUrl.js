export default function generateTaskUrl({ address, id }) {
  return `${process.env.LINGUO_BASE_URL}/translation/${address}/${id}`;
}
