import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyStreakToMoney,
  formatYuan,
  meetsMoneyMinimum,
  minutesUntilMoney,
  moneyFromDuration,
  moneyFromScore,
  sumEarnedYuan,
} from './dayMoney';

const hour = 60 * 60_000;

describe('dayMoney', () => {
  it('pays nothing below the 15-minute floor', () => {
    assert.equal(moneyFromDuration(6_000, 10, 15), 0);
    assert.equal(moneyFromDuration(14 * 60_000, 10, 15), 0);
    assert.equal(meetsMoneyMinimum(6_000, 15), false);
  });

  it('pays from duration only, ignoring score', () => {
    assert.equal(moneyFromDuration(hour, 10, 15), 10);
    assert.equal(moneyFromDuration(2 * hour, 10, 15), 30);
    assert.equal(moneyFromDuration(3 * hour, 10, 15), 60);
    assert.equal(moneyFromDuration(4 * hour, 10, 15), 100);
    assert.equal(moneyFromScore(0, 10, hour, 15), 10);
    assert.equal(moneyFromScore(100, 10, hour, 15), 10);
  });

  it('formats yuan', () => {
    assert.equal(formatYuan(10), '¥10');
    assert.equal(formatYuan(8.5), '¥8.5');
  });

  it('sums piggy bank', () => {
    assert.equal(sumEarnedYuan([{ earnedYuan: 8.5 }, { earnedYuan: 10 }, {}]), 18.5);
  });

  it('applies streak multiplier', () => {
    assert.equal(applyStreakToMoney(10, 1.3, 10), 13);
    assert.equal(applyStreakToMoney(10, 1.5, 10), 15);
    assert.equal(applyStreakToMoney(100, 1.5, 10), 150);
    assert.equal(applyStreakToMoney(0, 1.5, 10), 0);
  });

  it('reports minutes until money unlocks', () => {
    assert.equal(minutesUntilMoney(10 * 60_000, 15), 5);
    assert.equal(minutesUntilMoney(15 * 60_000, 15), 0);
  });
});
