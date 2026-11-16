'use client';

/**
 * Ссылка в подвале: «Настройки cookie».
 *
 * Позволяет изменить или отозвать согласие на обработку технических
 * данных в любой момент — требование ч. 1 ст. 18.1 Закона № 152-ФЗ.
 *
 * Кнопка выводится всегда: право изменить решение должно быть
 * доступно независимо от того, что пользователь выбрал раньше.
 */
export default function CookieSettingsLink({
  label = 'Настройки cookie',
}: {
  label?: string;
}) {
  const reset = () => {
    /* Сбрасываем выбор и перезагружаем — сторонние виджеты
       не должны подгружаться, пока согласия нет */
    try {
      window.localStorage.removeItem('genorg-consent');
    } catch {
      /* приватный режим — просто перезагружаем */
    }
    window.location.reload();
  };

  return (
    <button type="button" className="footer__cookie-btn" onClick={reset}>
      {label}
    </button>
  );
}
