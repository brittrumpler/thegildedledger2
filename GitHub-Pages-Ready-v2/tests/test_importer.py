import importlib.util,pathlib,sys,unittest
scripts=pathlib.Path(__file__).resolve().parents[1]/'scripts';sys.path.insert(0,str(scripts))
from sync_data import Tables,norm,event_drops
from enrich_data import Infobox,parse_price,composite_price
class ImporterTests(unittest.TestCase):
 def test_nested_enemy_loot_is_included_without_duplicate_edges(self):
  item={'kind':'item','slug':'captains-chest','edges':[{'id':'drop-1','active':True,'quantity':2}]}
  payload={'ring':[], 'groups':[{'kind':'group','enemy':True,'name':'Fleet ship','items':[], 'children':[{'kind':'group','items':[item,item]}]}]}
  drops=event_drops(payload,{'captains-chest'})
  self.assertEqual(len(drops),1)
  self.assertEqual(drops[0]['stage'],'Fleet ship')
  self.assertEqual(drops[0]['quantity'],2)
 def test_prices_require_currency_and_a_simple_value(self):
  self.assertEqual(parse_price(' 1,200 - 1,550 Gold '),{'min':1200,'max':1550,'currency':'gold'})
  self.assertEqual(parse_price('25 Doubloons'),{'min':25,'max':25,'currency':'doubloons'})
  for text in ['n/a','5,000 Gold or 10 Doubloons','5000','5,000 Gold (full)']:
   self.assertIsNone(parse_price(text))
 def test_explicit_commodity_conditions_and_alternate_currency(self):
  raw='<div class="druid-data-Sellprice">460 - 477 Gold 90 Gold 700 Gold (Normal)(Surplus)(Sought-after)</div>'
  value=composite_price(raw,'https://example.org','2026-11-10')
  self.assertEqual(value['min'],460)
  self.assertEqual([v['min'] for v in value['variants']],[460,90,700])
  raw='<div class="druid-data-Sellprice">10,000 Gold or 25 Doubloons</div>'
  value=composite_price(raw,'https://example.org','2026-11-10')
  self.assertEqual(value['variants'][1]['currency'],'doubloons')
  self.assertEqual(value['max'],10000)
 def test_infobox_separates_sell_price_from_emissary_value(self):
  p=Infobox();p.feed('<div><div class="druid-data-Sellprice"><div>15,000 <img alt="Gold"></div></div><div>30,000</div></div>')
  self.assertEqual(parse_price(''.join(p.price))['min'],15000)
 def test_table_image_currency_does_not_lose_gold_marker(self):
  p=Tables();p.feed('<table><tr><td>Chest</td><td>20,000 <img alt="Gold"></td></tr></table>')
  self.assertEqual(p.rows,[['Chest','20,000 Gold']])
 def test_name_matching_is_exact_after_punctuation(self):
  self.assertEqual(norm("Captain’s Chest"),norm("Captain's Chest"))
  self.assertNotEqual(norm('Chest of Legends'),norm('Ashen Chest of Legends'))
if __name__=='__main__':unittest.main()
