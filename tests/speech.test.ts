import { describe, expect, it } from 'vitest';
import { numberWords, speakable, speechKey, speechPlan } from '../src/core/speech';

const texts = (s: string) => speechPlan(s).map(sent => sent.map(p => p.text));

describe('numberWords', () => {
  it('рахує з родом', () => {
    expect(numberWords(0)).toBe('нуль');
    expect(numberWords(21)).toBe('двадцять один');
    expect(numberWords(21, 'f')).toBe('двадцять одна');
    expect(numberWords(1, 'fAcc')).toBe('одну');
    expect(numberWords(32, 'f')).toBe('тридцять дві');
    expect(numberWords(40)).toBe('сорок');
    expect(numberWords(100)).toBe('сто');
    expect(numberWords(12, 'gen')).toBe('дванадцяти');
    expect(numberWords(41, 'gen')).toBe('сорока одного');
  });
});

describe('speakable', () => {
  it('прибирає розмітку, емодзі й скорочення', () => {
    expect(speakable('🤔 Ти поставив(-ла) <b>7:35</b>')).toBe('Ти поставив 7:35');
    expect(speakable('Минуло 12,3 с, а треба було 10 с.')).toBe('Минуло 12 секунд, а треба було 10 секунд.');
  });
  it('не дублює електронний і словесний час', () => {
    expect(speakable('Правильно: 3:30 — пів на четверту')).toBe('Правильно: пів на четверту');
  });
});

describe('speechPlan', () => {
  it('ріже речення на сталі шматки й числа', () => {
    expect(texts('Минуло 20 хвилин.')).toEqual([['Минуло', 'двадцять', 'хвилин.']]);
    expect(texts('Прийди через 1 годину.')).toEqual([['Прийди', 'через одну', 'годину.']]);
  });
  it('словесний час — цілим шматком', () => {
    expect(texts('Постав стрілки на 20 хвилин на восьму.')).toEqual([['Постав стрілки на', 'двадцять хвилин на восьму']]);
    expect(texts('Правильно: за 1 хвилину восьма')).toEqual([['Правильно:', 'за одну хвилину восьма']]);
    expect(texts('Рівно сьома!')).toEqual([['рівно сьома']]);
    expect(texts('Стрілки стоять правильно: пів на дев’яту.')).toEqual([['Стрілки стоять правильно:', 'пів на дев’яту']]);
  });
  it('вимовляє електронний час словами', () => {
    expect(texts('Мультик почався о 3:20 і тривав пів години.')).toEqual([['Мультик почався', 'о третій', 'двадцять', 'і тривав пів години.']]);
    expect(texts('Тік прокидається о 7:00.')).toEqual([['Тік прокидається', 'о сьомій', '.'].filter(x => x !== '.')]);
    expect(texts('Ти поставив 14:05, а треба…')).toEqual([['Ти поставив', 'чотирнадцята', 'нуль п’ять', ', а треба.']]);
  });
  it('«7-та» стає порядковим', () => {
    expect(texts('Година ще 7-та.')).toEqual([['Година ще', 'сьома', '.']].map(s => s.filter(x => x !== '.')));
  });
  it('ділить на речення', () => {
    expect(speechPlan('Привіт! Готовий? Поїхали.')).toHaveLength(3);
  });
  it('ключ не залежить від регістру й розділових знаків', () => {
    expect(speechKey('Хвилин на восьму.')).toBe(speechKey('хвилин на восьму'));
  });
});
