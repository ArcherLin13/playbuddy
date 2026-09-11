import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyStreakToMoney,
  formatYuan,
  meetsMoneyMinimum,
  minutesUntilMoney,
  moneyFromScore,
  sumEarnedYuan,
} from './dayMoney';

describe('dayMoney', () => {
  it('pays nothing below the 30-minute floor', () => {
    assert.equal(moneyFromScore(100, 10, 6_000, 30), 0);
    assert.equal(moneyFromScore(100, 10, 29 * 60_000, 30), 0);
    assert.equal(meetsMoneyMinimum(6_000, 30), false);
  });

  it('pays from score once the floor is met', () => {
    assert.equal(moneyFromScore(100, 10, 30 * 60_000, 30), 10);
    assert.equal(moneyFromScore(85, 10, 35 * 60_000, 30), 8.5);
  });

  it('never exceeds the daily cap for base pay', () => {
    assert.equal(moneyFromScore(120, 10, 40 * 60_000, 30), 10);
  });

  it('formats yuan', () => {
    assert.equal(formatYuan(10), '¥10');
    assert.equal(formatYuan(8.5), '¥8.5');
  });

  it('sums piggy bank', () => {
    assert.equal(sumEarnedYuan([{ earnedYuan: 8.5 }, { earnedYuan: 10 }, {}]), 18.5);
  });

  it('applies streak multiplier above base but within 1.5x cap', () => {
    assert.equal(applyStreakToMoney(10, 1.3, 10), 13);
    assert.equal(applyStreakToMoney(10, 1.5, 10), 15);
    assert.equal(applyStreakToMoney(0, 1.5, 10), 0);
  });

  it('reports minutes until money unlocks', () => {
    assert.equal(minutesUntilMoney(10 * 60_000, 30), 20);
    assert.equal(minutesUntilMoney(30 * 60_000, 30), 0);
  });
});
