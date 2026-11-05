'use client';
import { useEffect, useRef, useState } from 'react';

export default function FocusClock() {
  const [minutes, setMinutes] = useState('25');
  const [seconds, setSeconds] = useState('0');
  const [duration, setDuration] = useState(25 * 60 * 1000);
  const [remaining, setRemaining] = useState(25 * 60 * 1000);
  const [deadline, setDeadline] = useState(null);
  const [message, setMessage] = useState('');
  const completionAlertShown = useRef(false);
  const completed = remaining === 0;

  useEffect(() => {
    if (!completed) {
      completionAlertShown.current = false;
      return;
    }
    if (!completionAlertShown.current) {
      completionAlertShown.current = true;
      window.alert('专注时间到！这一轮已经完成，休息一下吧。');
    }
  }, [completed]);

  useEffect(() => {
    if (deadline === null) return;
    function update() {
      const next = Math.max(0, deadline - Date.now());
      setRemaining(next);
      if (next === 0) setDeadline(null);
    }
    update();
    const timer = setInterval(update, 250);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pageshow', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pageshow', update);
    };
  }, [deadline]);

  function applyDuration(totalSeconds) {
    setDuration(totalSeconds * 1000);
    setRemaining(totalSeconds * 1000);
    setDeadline(null);
    setMessage('时长已设置，点击“开始专注”即可计时。');
  }

  function applyCustomDuration(event) {
    event.preventDefault();
    const minuteValue = Number(minutes);
    const secondValue = Number(seconds);
    const total = minuteValue * 60 + secondValue;
    if (!/^\d+$/.test(minutes) || !/^\d+$/.test(seconds) ||
        !Number.isInteger(minuteValue) || !Number.isInteger(secondValue) ||
        secondValue > 59 || total < 1 || total > 86400) {
      setMessage('请输入 1 秒到 24 小时之间的时长，秒数为 0–59。');
      return;
    }
    applyDuration(total);
  }

  function toggleTimer() {
    setMessage('');
    if (deadline !== null) {
      setRemaining(Math.max(0, deadline - Date.now()));
      setDeadline(null);
      return;
    }
    const next = remaining > 0 ? remaining : duration;
    setRemaining(next);
    setDeadline(Date.now() + next);
  }

  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minuteDisplay = String(Math.floor(totalSeconds % 3600 / 60)).padStart(2, '0');
  const secondDisplay = String(totalSeconds % 60).padStart(2, '0');
  const display = hours > 0 ? `${String(hours).padStart(2, '0')}:${minuteDisplay}:${secondDisplay}` : `${minuteDisplay}:${secondDisplay}`;
  const running = deadline !== null;
  const status = remaining === 0 ? '专注完成，休息一下吧。' : running ? '正在专注，一次只做好一件事。' : remaining < duration ? '已暂停，可以继续专注。' : '准备好了就开始吧。';

  return <section className="demo-panel timer focus-clock">
    <span className="eyebrow">ONE THING AT A TIME</span>
    <div className="focus-clock-display" role="timer" aria-label="剩余时间" aria-live="off">{display}</div>
    <progress className="focus-clock-progress" max={duration} value={duration - remaining} aria-label="专注进度"/>
    <div className="focus-clock-actions">
      <button className="button primary" type="button" onClick={toggleTimer}>{running ? '暂停' : remaining === 0 ? '再来一次' : remaining < duration ? '继续专注' : '开始专注'}</button>
      <button className="button secondary" type="button" onClick={() => {
        setDeadline(null);
        setRemaining(duration);
        setMessage('已恢复为设定时长。');
      }}>重置</button>
    </div>
    <p role="status">{message || status}</p>
    <form className="focus-clock-settings" onSubmit={applyCustomDuration}>
      <fieldset>
        <legend>自定义专注时长</legend>
        <div className="focus-clock-inputs">
          <label htmlFor="focus-minutes">分钟<input id="focus-minutes" type="number" inputMode="numeric" min="0" max="1440" step="1" required value={minutes} onChange={event => setMinutes(event.target.value)}/></label>
          <label htmlFor="focus-seconds">秒<input id="focus-seconds" type="number" inputMode="numeric" min="0" max="59" step="1" required value={seconds} onChange={event => setSeconds(event.target.value)}/></label>
          <button className="button secondary" type="submit">应用并重置</button>
        </div>
        <p className="muted">支持 1 秒至 24 小时。应用新时长后，计时将重置并等待开始。</p>
      </fieldset>
    </form>
    <div className="focus-clock-presets" role="group" aria-label="快捷设置时长">
      {[5, 15, 25, 45, 60].map(value => <button key={value} type="button" aria-pressed={duration === value * 60000} onClick={() => {
        setMinutes(String(value));
        setSeconds('0');
        applyDuration(value * 60);
      }}>{value} 分钟</button>)}
    </div>
  </section>;
}
