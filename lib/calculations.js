export function calcBudgetUtilisation(actualSpend, budgetSet) {
  if (!budgetSet || budgetSet === 0) return null
  return ((actualSpend / budgetSet) * 100).toFixed(2)
}

export function calcLeadAchievement(leadsGenerated, leadTarget) {
  if (!leadTarget || leadTarget === 0) return null
  return ((leadsGenerated / leadTarget) * 100).toFixed(2)
}

export function calcCPL(actualSpend, leadsGenerated) {
  if (!leadsGenerated || leadsGenerated === 0) return null
  return (actualSpend / leadsGenerated).toFixed(2)
}

export function calcCostPerConversion(actualSpend, conversions) {
  if (!conversions || conversions === 0) return null
  return (actualSpend / conversions).toFixed(2)
}

export function calcROAS(conversionValue, actualSpend) {
  if (!actualSpend || actualSpend === 0) return null
  return (conversionValue / actualSpend).toFixed(2)
}

export function calcKraScore(logs) {
  if (!logs || logs.length === 0) return 0
  const done = logs.filter((l) => l.status === 'done').length
  return Math.round((done / logs.length) * 100)
}
