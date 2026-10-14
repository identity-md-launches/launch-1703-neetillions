import type { SVGProps } from 'react'
type Name = 'arrow' | 'copy' | 'check' | 'refresh' | 'wallet' | 'close' | 'chevron' | 'home' | 'leaf' | 'fire' | 'code'
const paths: Record<Name, React.ReactNode> = {
  arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  refresh: <><path d="M20 11a8 8 0 0 0-14-5L3 9m0-6v6h6M4 13a8 8 0 0 0 14 5l3-3m0 6v-6h-6"/></>,
  wallet: <><path d="M19 8V5H5a2 2 0 0 0 0 4h15v11H5a2 2 0 0 1-2-2V7"/><path d="M20 12h-5v5h5"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  home: <><path d="m3 10 9-7 9 7M5 9v12h14V9"/><path d="M9 13h1m4 0h1m-5 4q2 2 4 0"/></>,
  leaf: <><path d="M19 4C8 3 3 8 6 15s14 3 13-11Z"/><path d="M4 21 15 10"/></>,
  fire: <path d="M13 3s1 5-3 8c-1-3-3-3-3-3s-4 6-2 10a8 8 0 0 0 14-1c2-7-6-14-6-14Z"/>,
  code: <><path d="m7 7-5 5 5 5m10-10 5 5-5 5M14 4l-4 16"/></>,
}
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: Name }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
export function HomeArt() {
  return <svg className="home-art" width="260" height="184" viewBox="0 0 260 184" fill="none" aria-hidden="true">
    <path d="M228 19a20 20 0 0 1-27 26 21 21 0 0 0 27-26Z" fill="#b6afe4"/>
    <g stroke="#666377" strokeWidth="1.5" strokeLinecap="round"><path d="M32 39v8m-4-4h8m139-25v6m-3-3h6M53 78v5m-2.5-2.5h5"/></g>
    <path d="M39 163h184M63 161V85l65-50 66 50v76" stroke="#878095" strokeWidth="2" strokeLinejoin="round"/>
    <path d="m51 94 77-61 77 61M170 62V39h13v34" stroke="#b6afe4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="115" y="66" width="27" height="26" rx="2" fill="#282530" stroke="#878095" strokeWidth="1.5"/><path d="M128.5 67v24M116 79h25" stroke="#878095" strokeWidth="1.5"/>
    <g stroke="#bbb4da" strokeWidth="2" strokeLinejoin="round"><path d="M92 126v-11a6 6 0 0 1 6-6h61a6 6 0 0 1 6 6v11"/><path d="M88 120a5 5 0 0 1 5 5v10h71v-10a5 5 0 0 1 10 0v20H83v-20a5 5 0 0 1 5-5Z" fill="#33303f"/><path d="M91 146v8m75-8v8" strokeLinecap="round"/></g>
    <path d="M112 123c4 3 8 3 12 0m13 0c4 3 8 3 12 0" stroke="#c3bcf5" strokeWidth="2" strokeLinecap="round"/>
    <path d="M52 150h9m-5-1v-11m0 7c-6-1-8-5-6-8 5 0 7 4 6 8m0-6c0-5 4-8 7-6-1 4-3 6-7 6" stroke="#6e8974" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
}
