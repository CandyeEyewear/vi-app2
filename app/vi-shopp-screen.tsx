/**
 * VI Shopp Screen
 * Browse and purchase VI merchandise
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { ShoppingBag, ExternalLink, X } from 'lucide-react-native';

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: any; // Will use require() for local images
  checkoutUrl: string;
}

const PRODUCTS: Product[] = [
  {
    id: 'tshirt',
    name: 'VI-Branded T-Shirt',
    price: 34.00,
    description: 'Premium quality t-shirt with VI branding. Show your volunteer pride!',
    image: require('../assets/images/products/tshirt.png'), // You'll add these images
    checkoutUrl: 'https://volunteersinc.org/t-shirt-purchase',
  },
  {
    id: 'cap',
    name: 'VI-Branded Cap',
    price: 25.00,
    description: 'Comfortable cap with VI logo. Perfect for outdoor volunteer activities.',
    image: require('../assets/images/products/cap.png'),
    checkoutUrl: 'https://volunteersinc.org/cap-purchase',
  },
  {
    id: 'tumbler',
    name: 'VI-Branded Tumbler',
    price: 34.00,
    description: 'Insulated tumbler to keep your drinks hot or cold during volunteer events.',
    image: require('../assets/images/products/tumbler.png'),
    checkoutUrl: 'https://volunteersinc.org/tumbler-purchase',
  },
  {
    id: 'sunglasses',
    name: 'VI-Branded Sunglasses',
    price: 60.00,
    description: 'Stylish sunglasses with UV protection. Look cool while doing good!',
    image: require('../assets/images/products/sunglasses.png'),
    checkoutUrl: 'https://volunteersinc.org/sunglasses-purchase',
  },
];

export default function VIShoppScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBuyNow = (product: Product) => {
    Linking.openURL(product.checkoutUrl);
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ShoppingBag size={24} color={Colors.light.primary} />
          <Text style={styles.headerTitle}>VI Shopp</Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.7}
        >
          <X size={24} color={Colors.light.text} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Store Description */}
        <View style={styles.storeHeader}>
          <Text style={styles.storeTitle}>Official VI Merchandise</Text>
          <Text style={styles.storeDescription}>
            Support Volunteers Incorporated by purchasing official branded merchandise. 
            All proceeds go towards our mission of changing communities through volunteerism.
          </Text>
        </View>

        {/* Products Grid */}
        <View style={styles.productsContainer}>
          {PRODUCTS.map((product) => (
            <View key={product.id} style={styles.productCard}>
              {/* Product Image */}
              <View style={styles.imageContainer}>
                <Image
                  source={product.image}
                  style={styles.productImage}
                  resizeMode="cover"
                />
              </View>

              {/* Product Info */}
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productDescription}>{product.description}</Text>
                <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
              </View>

              {/* Buy Button */}
              <TouchableOpacity
                style={styles.buyButton}
                onPress={() => handleBuyNow(product)}
                activeOpacity={0.7}
              >
                <Text style={styles.buyButtonText}>Buy Now</Text>
                <ExternalLink size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Secure checkout powered by HubSpot
          </Text>
          <Text style={styles.footerSubtext}>
            Questions? Contact us at info@volunteersinc.org
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.light.card,
  },
  scrollView: {
    flex: 1,
  },
  storeHeader: {
    padding: 20,
    backgroundColor: Colors.light.card,
    marginBottom: 16,
  },
  storeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 8,
  },
  storeDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  productsContainer: {
    padding: 16,
    gap: 16,
  },
  productCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    padding: 16,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  productPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  buyButton: {
    backgroundColor: Colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    margin: 16,
    marginTop: 0,
    borderRadius: 8,
  },
  buyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
});
