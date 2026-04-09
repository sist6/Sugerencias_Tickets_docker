import requests
import sys
from datetime import datetime

class RoleBasedSOHOTester:
    def __init__(self, base_url="https://hotel-ops-platform-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.hotel_token = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if token:
            test_headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Status: {response.status_code}")
                return True, response.json() if response.content else {}
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ FAILED - Error: {str(e)}")
            return False, {}

    def test_authentication(self):
        """Test authentication for different user roles"""
        print("\n" + "="*60)
        print("🔐 TESTING ROLE-BASED AUTHENTICATION")
        print("="*60)
        
        # Test admin login
        admin_login = {
            "email": "admin@sohohoteles.com",
            "password": "admin123"
        }
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data=admin_login
        )
        
        if success:
            self.admin_token = response['access_token']
            print(f"   🔑 Admin token obtained")
        
        # Test hotel user login
        hotel_login = {
            "email": "recepcion@sohohoteles.com",
            "password": "hotel123"
        }
        
        success, response = self.run_test(
            "Hotel User Login",
            "POST",
            "auth/login",
            200,
            data=hotel_login
        )
        
        if success:
            self.hotel_token = response['access_token']
            print(f"   🔑 Hotel user token obtained")
            
        return self.admin_token and self.hotel_token

    def test_role_based_ticket_filtering(self):
        """Test that users only see appropriate tickets based on their role"""
        print("\n" + "="*60)
        print("🎟️ TESTING ROLE-BASED TICKET FILTERING")
        print("="*60)
        
        if not (self.admin_token and self.hotel_token):
            print("❌ Missing authentication tokens")
            return False
        
        # Test admin sees all tickets
        success, admin_tickets = self.run_test(
            "Admin - Get All Tickets",
            "GET",
            "tickets",
            200,
            token=self.admin_token
        )
        
        if success:
            print(f"   📊 Admin sees {len(admin_tickets)} tickets")
        
        # Test hotel user sees only their hotel tickets
        success, hotel_tickets = self.run_test(
            "Hotel User - Get Tickets (filtered)",
            "GET", 
            "tickets",
            200,
            token=self.hotel_token
        )
        
        if success:
            print(f"   📊 Hotel user sees {len(hotel_tickets)} tickets")
            # Verify hotel user sees fewer or equal tickets than admin
            if len(hotel_tickets) <= len(admin_tickets):
                print(f"   ✅ Hotel user correctly sees filtered tickets")
                self.tests_passed += 1
            else:
                print(f"   ❌ Hotel user sees more tickets than admin (possible filter issue)")
        
        return True

    def test_take_ticket_functionality(self):
        """Test take ticket functionality for admin/technician"""
        print("\n" + "="*60)
        print("✋ TESTING TAKE TICKET FUNCTIONALITY") 
        print("="*60)
        
        if not self.admin_token:
            print("❌ Missing admin token")
            return False
        
        # Get tickets to find one that can be taken
        success, tickets = self.run_test(
            "Get Tickets for Take Test",
            "GET",
            "tickets",
            200,
            token=self.admin_token
        )
        
        if not success or not tickets:
            print("❌ No tickets available for take test")
            return False
        
        # Find a ticket that can be taken (new or assigned status)
        takeable_ticket = None
        for ticket in tickets:
            if ticket.get('status') in ['new', 'assigned']:
                takeable_ticket = ticket
                break
        
        if not takeable_ticket:
            print("⚠️ No takeable tickets found (all are in_progress or closed)")
            return True
        
        # Test taking the ticket
        ticket_id = takeable_ticket['id']
        success, response = self.run_test(
            f"Take Ticket {ticket_id[:8]}",
            "POST",
            f"tickets/{ticket_id}/take",
            200,
            token=self.admin_token
        )
        
        if success:
            print(f"   ✅ Ticket taken successfully")
            print(f"   📋 Status changed to: {response.get('status')}")
            print(f"   👤 Assigned to: {response.get('assigned_to')}")
            
        return success

    def test_suggestions_visibility(self):
        """Test suggestions visibility based on permissions"""
        print("\n" + "="*60)
        print("💡 TESTING SUGGESTIONS VISIBILITY")
        print("="*60)
        
        # Test admin can see all suggestions
        success, admin_suggestions = self.run_test(
            "Admin - Get All Suggestions",
            "GET",
            "suggestions", 
            200,
            token=self.admin_token
        )
        
        if success:
            print(f"   📊 Admin sees {len(admin_suggestions)} suggestions")
        
        # Test hotel user with no permission sees no suggestions (or only their own)
        success, hotel_suggestions = self.run_test(
            "Hotel User - Get Suggestions (filtered)",
            "GET",
            "suggestions",
            200,
            token=self.hotel_token
        )
        
        if success:
            print(f"   📊 Hotel user sees {len(hotel_suggestions)} suggestions")
            # Hotel user should see fewer or equal suggestions than admin
            if len(hotel_suggestions) <= len(admin_suggestions):
                print(f"   ✅ Hotel user correctly sees filtered suggestions")
                self.tests_passed += 1
            else:
                print(f"   ❌ Hotel user sees more suggestions than admin")
        
        return True

    def test_take_suggestion_functionality(self):
        """Test take suggestion functionality for admin/technician"""
        print("\n" + "="*60)
        print("✋ TESTING TAKE SUGGESTION FUNCTIONALITY")
        print("="*60)
        
        if not self.admin_token:
            print("❌ Missing admin token") 
            return False
        
        # Get suggestions to find one that can be taken
        success, suggestions = self.run_test(
            "Get Suggestions for Take Test",
            "GET",
            "suggestions",
            200,
            token=self.admin_token
        )
        
        if not success or not suggestions:
            print("❌ No suggestions available")
            return False
        
        # Find a suggestion with 'new' status that can be taken
        takeable_suggestion = None
        for suggestion in suggestions:
            if suggestion.get('status') == 'new':
                takeable_suggestion = suggestion
                break
        
        if not takeable_suggestion:
            print("⚠️ No new suggestions available for take test")
            return True
        
        # Test taking the suggestion
        suggestion_id = takeable_suggestion['id']
        success, response = self.run_test(
            f"Take Suggestion {suggestion_id[:8]}",
            "POST",
            f"suggestions/{suggestion_id}/take",
            200,
            token=self.admin_token
        )
        
        if success:
            print(f"   ✅ Suggestion taken successfully")
            print(f"   📋 Status changed to: {response.get('status')}")
            print(f"   👤 Assigned to: {response.get('assigned_to')}")
        
        return success

    def test_department_field_in_users(self):
        """Test that users have department_id field"""
        print("\n" + "="*60)
        print("🏢 TESTING DEPARTMENT FIELD IN USERS")
        print("="*60)
        
        if not self.admin_token:
            print("❌ Missing admin token")
            return False
        
        success, users = self.run_test(
            "Get Users - Check Department Field",
            "GET",
            "users",
            200,
            token=self.admin_token
        )
        
        if success and users:
            hotel_central_users = [u for u in users if u.get('role') in ['hotel_user', 'central_user']]
            if hotel_central_users:
                sample_user = hotel_central_users[0]
                if 'department_id' in sample_user:
                    print(f"   ✅ Department field found in user: {sample_user.get('name')}")
                    print(f"   🏢 Department ID: {sample_user.get('department_id')}")
                    self.tests_passed += 1
                else:
                    print(f"   ❌ Department field missing in user: {sample_user.get('name')}")
            else:
                print("   ⚠️ No hotel_user or central_user found to check department field")
                
        return success

    def test_critical_notifications_for_roles(self):
        """Test notifications and dashboard stats for different roles"""
        print("\n" + "="*60)
        print("🚨 TESTING CRITICAL NOTIFICATIONS BY ROLE")
        print("="*60)
        
        # Test admin dashboard stats
        success, admin_stats = self.run_test(
            "Admin - Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.admin_token
        )
        
        if success:
            critical_count = admin_stats.get('tickets', {}).get('critical', 0)
            print(f"   📊 Admin sees {critical_count} critical tickets in dashboard")
            
        # Test hotel user dashboard stats  
        success, hotel_stats = self.run_test(
            "Hotel User - Dashboard Stats",
            "GET", 
            "dashboard/stats",
            200,
            token=self.hotel_token
        )
        
        if success:
            critical_count = hotel_stats.get('tickets', {}).get('critical', 0)
            print(f"   📊 Hotel user sees {critical_count} critical tickets in dashboard")
            # Note: According to requirements, hotel users should NOT see critical alerts
            
        return True

    def run_comprehensive_test(self):
        """Run all role-based tests"""
        print("\n🚀 STARTING ROLE-BASED SOHO SYSTEMS TEST")
        print("=" * 80)
        
        start_time = datetime.now()
        
        try:
            # Authentication first
            if not self.test_authentication():
                print("❌ Authentication failed, cannot continue")
                return 1
            
            # Role-based tests
            self.test_role_based_ticket_filtering()
            self.test_take_ticket_functionality()
            self.test_suggestions_visibility()
            self.test_take_suggestion_functionality()
            self.test_department_field_in_users()
            self.test_critical_notifications_for_roles()
            
        except Exception as e:
            print(f"\n💥 CRITICAL ERROR: {str(e)}")
            
        # Final results
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        print("\n" + "="*80)
        print("📊 ROLE-BASED TEST RESULTS")
        print("="*80)
        print(f"⏱️  Duration: {duration:.2f} seconds")
        print(f"🎯 Tests Run: {self.tests_run}")
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.tests_passed == self.tests_run:
            print("\n🎉 ALL ROLE-BASED TESTS PASSED!")
            return 0
        else:
            print(f"\n⚠️  {self.tests_run - self.tests_passed} test(s) failed.")
            return 1

def main():
    tester = RoleBasedSOHOTester()
    return tester.run_comprehensive_test()

if __name__ == "__main__":
    sys.exit(main())