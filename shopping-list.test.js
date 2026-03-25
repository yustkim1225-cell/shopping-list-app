// 쇼핑 리스트 앱 자동 테스트
// 실행: node shopping-list.test.js

const { chromium } = require('playwright');
const path = require('path');

const FILE_URL = `file:///${path.resolve(__dirname, 'shopping-list.html').replace(/\\/g, '/')}`;

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    results.push({ name: testName, status: 'PASS' });
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${testName}`);
    results.push({ name: testName, status: 'FAIL' });
    failed++;
  }
}

async function clearStorage(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(FILE_URL);
  await page.waitForLoadState('domcontentloaded');

  // ─────────────────────────────────────────
  console.log('\n📋 [1] 아이템 추가 테스트');
  // ─────────────────────────────────────────

  await clearStorage(page);

  // 1-1. 단일 아이템 추가 (버튼 클릭)
  await page.fill('#itemInput', '사과');
  await page.click('#addBtn');
  await page.waitForTimeout(200);
  const item1Text = await page.textContent('.item-text');
  assert(item1Text?.includes('사과'), '버튼 클릭으로 아이템 추가');

  // 1-2. Enter 키로 아이템 추가
  await page.fill('#itemInput', '바나나');
  await page.press('#itemInput', 'Enter');
  await page.waitForTimeout(200);
  const itemTexts = await page.$$eval('.item-text', els => els.map(e => e.textContent));
  assert(itemTexts.some(t => t.includes('바나나')), 'Enter 키로 아이템 추가');

  // 1-3. 여러 아이템 추가 후 개수 확인
  await page.fill('#itemInput', '우유');
  await page.press('#itemInput', 'Enter');
  await page.waitForTimeout(200);
  const itemCount = await page.$$eval('.item', els => els.length);
  assert(itemCount === 3, `3개 아이템 추가 확인 (현재: ${itemCount}개)`);

  // 1-4. 빈 입력 무시 확인
  await page.fill('#itemInput', '  ');
  await page.click('#addBtn');
  await page.waitForTimeout(200);
  const itemCountAfterEmpty = await page.$$eval('.item', els => els.length);
  assert(itemCountAfterEmpty === 3, `빈 입력 무시 (개수 유지: ${itemCountAfterEmpty}개)`);

  // 1-5. 통계 업데이트 확인
  const statsText = await page.textContent('#stats');
  assert(statsText?.includes('3'), `통계 업데이트 확인 ("${statsText}")`);

  // ─────────────────────────────────────────
  console.log('\n✅ [2] 체크(완료) 기능 테스트');
  // ─────────────────────────────────────────

  // 2-1. 체크박스 클릭으로 완료 처리
  const firstCheckbox = await page.$('.item input[type="checkbox"]');
  await firstCheckbox.click();
  await page.waitForTimeout(200);
  const firstItemDone = await page.$eval('.item:first-child', el => el.classList.contains('done'));
  assert(firstItemDone, '체크박스 클릭 → done 클래스 추가');

  // 2-2. 취소선 스타일 적용 확인
  const strikeThrough = await page.$eval('.item.done .item-text', el => {
    return getComputedStyle(el).textDecoration;
  });
  assert(strikeThrough.includes('line-through'), `완료 항목 취소선 스타일 적용 ("${strikeThrough}")`);

  // 2-3. 체크 해제 (토글) - 리렌더 후 재참조
  await page.click('.item:first-child input[type="checkbox"]');
  await page.waitForTimeout(200);
  const firstItemUndone = await page.$eval('.item:first-child', el => !el.classList.contains('done'));
  assert(firstItemUndone, '체크박스 재클릭 → done 클래스 제거 (토글)');

  // 2-4. 완료 개수 통계 반영
  await page.click('.item:first-child input[type="checkbox"]'); // 다시 완료
  await page.waitForTimeout(200);
  const statsAfterCheck = await page.textContent('#stats');
  assert(statsAfterCheck?.includes('완료 1'), `완료 통계 카운트 업데이트 ("${statsAfterCheck}")`);

  // ─────────────────────────────────────────
  console.log('\n🔽 [3] 필터 기능 테스트');
  // ─────────────────────────────────────────

  // 현재 상태: 사과(완료), 바나나(미완료), 우유(미완료)
  // 3-1. 미완료 필터
  await page.click('[data-filter="todo"]');
  await page.waitForTimeout(200);
  const todoItems = await page.$$eval('.item', els => els.length);
  assert(todoItems === 2, `미완료 필터: 2개 표시 (현재: ${todoItems}개)`);

  // 3-2. 완료 필터
  await page.click('[data-filter="done"]');
  await page.waitForTimeout(200);
  const doneItems = await page.$$eval('.item', els => els.length);
  assert(doneItems === 1, `완료 필터: 1개 표시 (현재: ${doneItems}개)`);

  // 3-3. 전체 필터
  await page.click('[data-filter="all"]');
  await page.waitForTimeout(200);
  const allItems = await page.$$eval('.item', els => els.length);
  assert(allItems === 3, `전체 필터: 3개 표시 (현재: ${allItems}개)`);

  // 3-4. 필터 버튼 active 클래스 확인
  const activeFilter = await page.$eval('[data-filter="all"]', el => el.classList.contains('active'));
  assert(activeFilter, '전체 필터 버튼 active 상태');

  // ─────────────────────────────────────────
  console.log('\n🗑 [4] 삭제 기능 테스트');
  // ─────────────────────────────────────────

  // 4-1. 개별 아이템 삭제
  const beforeDelete = await page.$$eval('.item', els => els.length);
  await page.click('.item:last-child .del-btn');
  await page.waitForTimeout(300);
  const afterDelete = await page.$$eval('.item', els => els.length);
  assert(afterDelete === beforeDelete - 1, `개별 삭제: ${beforeDelete}개 → ${afterDelete}개`);

  // 4-2. 완료 항목 일괄 삭제
  // 현재: 사과(완료), 바나나(미완료)
  const clearDoneBtn = await page.$('#clearDone');
  const isBtnDisabled = await clearDoneBtn.isDisabled();
  assert(!isBtnDisabled, '완료 항목 있을 때 "완료 항목 삭제" 버튼 활성화');

  await clearDoneBtn.click();
  await page.waitForTimeout(300);
  const afterClearDone = await page.$$eval('.item', els => els.length);
  assert(afterClearDone === 1, `완료 항목 일괄 삭제 후 1개 남음 (현재: ${afterClearDone}개)`);

  // 4-3. 완료 항목 없을 때 버튼 비활성화
  const isBtnDisabledNow = await clearDoneBtn.isDisabled();
  assert(isBtnDisabledNow, '완료 항목 없을 때 "완료 항목 삭제" 버튼 비활성화');

  // 4-4. 모든 항목 삭제 후 빈 상태 메시지
  await page.click('.item:first-child .del-btn');
  await page.waitForTimeout(300);
  const emptyMsg = await page.$('.empty');
  assert(emptyMsg !== null, '모든 항목 삭제 후 빈 상태 메시지 표시');

  // ─────────────────────────────────────────
  console.log('\n💾 [5] localStorage 영속성 테스트');
  // ─────────────────────────────────────────

  // 5-1. 아이템 추가 후 새로고침
  await page.fill('#itemInput', '오렌지');
  await page.press('#itemInput', 'Enter');
  await page.waitForTimeout(200);
  await page.fill('#itemInput', '포도');
  await page.press('#itemInput', 'Enter');
  await page.waitForTimeout(200);

  // 체크 처리
  await page.click('.item:last-child input[type="checkbox"]');
  await page.waitForTimeout(200);

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300);

  const afterReloadCount = await page.$$eval('.item', els => els.length);
  assert(afterReloadCount === 2, `새로고침 후 데이터 유지 (${afterReloadCount}개)`);

  const afterReloadDone = await page.$$eval('.item.done', els => els.length);
  assert(afterReloadDone === 1, `새로고침 후 완료 상태 유지 (완료 ${afterReloadDone}개)`);

  // ─────────────────────────────────────────
  // 최종 결과 출력
  // ─────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log(`📊 테스트 결과: ${passed + failed}개 중 ${passed}개 통과, ${failed}개 실패`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n🎉 모든 테스트 통과!\n');
  } else {
    console.log('\n실패한 테스트:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ❌ ${r.name}`));
    console.log();
  }

  await page.waitForTimeout(1500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
