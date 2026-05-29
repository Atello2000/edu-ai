export default function Logo({ size = 32 }) {
  return (
    <span className="jlogo">
      <svg className="jlogo-spark" width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <line x1="11" y1="39" x2="25" y2="27" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" opacity=".85"/>
        <line x1="25" y1="27" x2="37" y2="9" stroke="var(--purple)" strokeWidth="2.2" strokeLinecap="round" opacity=".85"/>
        <line x1="11" y1="39" x2="37" y2="9" stroke="var(--purple)" strokeWidth=".8" opacity=".2" strokeLinecap="round"/>
        <line x1="25" y1="27" x2="38" y2="31" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
        <circle cx="38" cy="31" r="2.2" fill="var(--purple)" opacity=".65"/>
        <line x1="11" y1="39" x2="5" y2="30" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
        <circle cx="5" cy="30" r="2.2" fill="var(--gold)" opacity=".65"/>
        <circle cx="11" cy="39" r="5.5" fill="var(--gold)" opacity=".12"/>
        <circle cx="11" cy="39" r="3.5" fill="var(--gold)" opacity=".35"/>
        <circle cx="11" cy="39" r="2.2" fill="var(--gold)"/>
        <circle cx="25" cy="27" r="4.5" fill="var(--purple)" opacity=".12"/>
        <circle cx="25" cy="27" r="3" fill="var(--purple)" opacity=".35"/>
        <circle cx="25" cy="27" r="1.9" fill="var(--purple)"/>
        <circle cx="37" cy="9" r="8" fill="var(--teal)" opacity=".08"/>
        <circle cx="37" cy="9" r="5.5" fill="var(--teal)" opacity=".18"/>
        <circle cx="37" cy="9" r="3.5" fill="var(--teal)" opacity=".75"/>
        <circle cx="37" cy="9" r="1.8" fill="var(--bg)"/>
      </svg>
      <span className="jlogo-word">jangal<em>ai</em></span>
    </span>
  );
}
